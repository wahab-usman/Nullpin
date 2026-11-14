const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

// 1. Get credentials via Git Credential Manager
function getGitToken() {
  const output = execSync('git credential fill', {
    input: 'protocol=https\nhost=github.com\n\n',
    encoding: 'utf8',
  });
  const lines = output.split('\n');
  const passLine = lines.find((l) => l.startsWith('password='));
  if (!passLine) throw new Error('Could not retrieve GitHub token from git credentials');
  return passLine.slice(9).trim();
}

const token = getGitToken();
const owner = 'wahab-usman';
const repo = 'Nullpin';
const tag = 'v1.0.0';

function apiRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'User-Agent': 'NullPin-Uploader',
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    };

    const reqOptions = {
      ...options,
      headers: { ...defaultHeaders, ...(options.headers || {}) },
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed = data;
        try {
          parsed = JSON.parse(data);
        } catch {}
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsed);
        } else {
          const err = new Error(`HTTP ${res.statusCode}: ${typeof parsed === 'object' ? JSON.stringify(parsed) : parsed}`);
          err.statusCode = res.statusCode;
          err.response = parsed;
          reject(err);
        }
      });
    });

    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

function uploadAsset(uploadUrlTemplate, filePath, filename, contentType) {
  return new Promise((resolve, reject) => {
    const stats = fs.statSync(filePath);
    const cleanUploadUrl = uploadUrlTemplate.replace(/\{(\?name,label|.*)\}/, '');
    const targetUrl = new URL(`${cleanUploadUrl}?name=${encodeURIComponent(filename)}`);

    console.log(`Uploading ${filename} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)...`);

    const options = {
      hostname: targetUrl.hostname,
      path: targetUrl.pathname + targetUrl.search,
      method: 'POST',
      headers: {
        'User-Agent': 'NullPin-Uploader',
        Authorization: `Bearer ${token}`,
        'Content-Type': contentType,
        'Content-Length': stats.size,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`Successfully uploaded ${filename}!`);
            resolve(parsed);
          } else {
            reject(new Error(`Upload failed (${res.statusCode}): ${data}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse upload response (${res.statusCode}): ${data}`));
        }
      });
    });

    req.on('error', reject);

    const fileStream = fs.createReadStream(filePath);
    let uploadedBytes = 0;
    let lastLoggedPercent = 0;

    fileStream.on('data', (chunk) => {
      uploadedBytes += chunk.length;
      const percent = Math.floor((uploadedBytes / stats.size) * 100);
      if (percent - lastLoggedPercent >= 20 || percent === 100) {
        console.log(`  > ${filename}: ${percent}% (${(uploadedBytes / (1024 * 1024)).toFixed(1)} MB)`);
        lastLoggedPercent = percent;
      }
    });

    fileStream.pipe(req);
  });
}

async function main() {
  console.log(`Fetching release ${tag} for ${owner}/${repo}...`);
  let release;
  try {
    release = await apiRequest({
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/releases/tags/${tag}`,
      method: 'GET',
    });
    console.log(`Found existing release: ID ${release.id}`);
  } catch (err) {
    if (err.statusCode === 404) {
      console.log(`Release ${tag} does not exist. Creating...`);
      release = await apiRequest(
        {
          hostname: 'api.github.com',
          path: `/repos/${owner}/${repo}/releases`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        {
          tag_name: tag,
          target_commitish: 'main',
          name: `NullPin ${tag}`,
          body: `## NullPin ${tag} — Zero-Trace Volatile RAM File Drop\n\n### Official Downloads\n- 🖥️ **Windows Setup Installer**: [NullPin-Setup.exe](https://github.com/${owner}/${repo}/releases/download/${tag}/NullPin-Setup.exe)\n- 📱 **Android Standalone App**: [NullPin.apk](https://github.com/${owner}/${repo}/releases/download/${tag}/NullPin.apk)`,
          draft: false,
          prerelease: false,
        }
      );
      console.log(`Created release ID ${release.id}`);
    } else {
      throw err;
    }
  }

  // Check existing assets
  const existingAssets = await apiRequest({
    hostname: 'api.github.com',
    path: `/repos/${owner}/${repo}/releases/${release.id}/assets`,
    method: 'GET',
  });

  const filesToUpload = [
    {
      name: 'NullPin-Setup.exe',
      path: path.join(__dirname, '../release/NullPin-Setup.exe'),
      type: 'application/vnd.microsoft.portable-executable',
    },
    {
      name: 'NullPin.apk',
      path: path.join(__dirname, '../release/NullPin.apk'),
      type: 'application/vnd.android.package-archive',
    },
  ];

  for (const file of filesToUpload) {
    if (!fs.existsSync(file.path)) {
      console.warn(`File not found, skipping: ${file.path}`);
      continue;
    }

    const existing = existingAssets.find((a) => a.name === file.name);
    if (existing) {
      console.log(`Asset ${file.name} already exists (ID ${existing.id}). Deleting to replace with latest build...`);
      await apiRequest({
        hostname: 'api.github.com',
        path: `/repos/${owner}/${repo}/releases/assets/${existing.id}`,
        method: 'DELETE',
      });
      console.log(`Deleted old asset ${file.name}`);
    }

    await uploadAsset(release.upload_url, file.path, file.name, file.type);
  }

  console.log('\n🎉 ALL RELEASE ASSETS PUBLISHED TO GITHUB RELEASES SUCCESSFULLY!');
}

main().catch((err) => {
  console.error('\n❌ Release publishing error:', err);
  process.exit(1);
});

