interface TransformResult {
  x: number;
  y: number;
}

export const mapPointToScreen = (
  point: { x: number; y: number },
  frameWidth: number,
  frameHeight: number,
  screenWidth: number,
  screenHeight: number,
): TransformResult => {
  const frameAspect = frameWidth / frameHeight;
  const screenAspect = screenWidth / screenHeight;

  let scale,
    offsetX = 0,
    offsetY = 0;

  if (frameAspect > screenAspect) {
    // Frame szélesebb → magassághoz igazít, szélesség vágódik
    scale = screenHeight / frameHeight;
    const scaledWidth = frameWidth * scale;
    offsetX = (scaledWidth - screenWidth) / 2; // középre igazít
  } else {
    // Frame magasabb → szélességhez igazít, magasság vágódik
    scale = screenWidth / frameWidth;
    const scaledHeight = frameHeight * scale;
    offsetY = (scaledHeight - screenHeight) / 2;
  }

  return {
    x: point.x * scale - offsetX,
    y: point.y * scale - offsetY,
  };
};
