import confetti from 'canvas-confetti';

export function fireVaporizeSparks() {
  // Fire high energy disintegration burst
  const count = 120;
  const defaults = {
    origin: { y: 0.6 },
    zIndex: 9999,
  };

  function fire(particleRatio, opts) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
    });
  }

  // Emerald & crimson glowing particle burst
  fire(0.25, {
    spread: 30,
    startVelocity: 55,
    colors: ['#10B981', '#34D399', '#059669'],
  });
  fire(0.2, {
    spread: 60,
    colors: ['#F43F5E', '#FB7185', '#E11D48'],
  });
  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.8,
    colors: ['#38BDF8', '#818CF8', '#F59E0B'],
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    scalar: 1.2,
    colors: ['#10B981', '#FFFFFF'],
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 45,
    colors: ['#F43F5E', '#10B981'],
  });
}

