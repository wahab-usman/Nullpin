// Built-in high fidelity demo presets for NullPin
export const DEMO_PRESETS = {
  document: {
    mode: 'doc',
    file: {
      name: 'CS412_Distributed_Systems_Lab4.pdf',
      size: 1845200,
      pages: 4,
      author: 'Univ Research Lab 304',
      type: 'application/pdf',
    },
    textContent: '',
    frontPreview: null,
    backPreview: null,
    prefs: {
      colorMode: 'bw',
      sides: 'double',
      copies: 2,
      burnAfterPrint: true,
    },
  },
  idcard: {
    mode: 'idcard',
    file: {
      name: 'Student_ID_National_Card.a4',
      size: 980400,
      pages: 1,
      author: 'ID Verification Terminal',
      type: 'image/composite',
    },
    textContent: '',
    frontPreview: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80',
    backPreview: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
    prefs: {
      colorMode: 'color',
      sides: 'single',
      copies: 1,
      burnAfterPrint: true,
    },
  },
  snippet: {
    mode: 'snippet',
    file: {
      name: 'sharding_cluster_setup.py',
      size: 1420,
      pages: 1,
      author: 'Python 3.12 Engine',
      type: 'text/x-python',
    },
    textContent: `#!/usr/bin/env python3
# NullPin Zero-Trace High-Speed Cluster Dispatcher
import os, sys, hashlib, secrets

class EphemeralNode:
    def __init__(self, node_id: str):
        self.node_id = node_id
        self.entropy_pool = secrets.token_bytes(32)
        print(f"[INIT] Node {self.node_id} active in volatile RAM.")

    def burn(self):
        # Overwrite in place before deallocating
        self.entropy_pool = b"\\x00" * 32
        print(f"[BURN] Node {self.node_id} wiped from memory.")

if __name__ == "__main__":
    cluster = [EphemeralNode(f"core-0{i}") for i in range(4)]
    print("[STATUS] 4 volatile nodes ready for print pipe.")`,
    frontPreview: null,
    backPreview: null,
    prefs: {
      colorMode: 'bw',
      sides: 'single',
      copies: 1,
      burnAfterPrint: true,
    },
  },
};

