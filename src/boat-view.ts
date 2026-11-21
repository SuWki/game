export function drawBoat(canvas: HTMLCanvasElement, complete: readonly boolean[]) {
  const pen = canvas.getContext('2d');
  if (!pen) return;
  const block = (color: string, x: number, y: number, width: number, height: number) => {
    pen.fillStyle = color;
    pen.fillRect(x, y, width, height);
  };
  pen.clearRect(0, 0, canvas.width, canvas.height);
  for (const [x, y, width] of [[4, 47, 20], [16, 52, 19], [48, 55, 33], [82, 47, 13], [67, 50, 13]]) {
    block('#8dc4bb', x, y, width, 1);
  }
  block('#45382c', 5, 29, 4, 24);
  block('#ebc68e', 4, 29, 6, 2);
  block('#c49e69', 8, 38, 12, 1);
  if (complete[1]) {
    block('#795336', 20, 44, 61, 4);
    block('#44352a', 26, 48, 49, 2);
  }
  if (complete[0]) {
    block('#382c26', 15, 36, 73, 3);
    block('#986b43', 18, 39, 67, 4);
    block('#bb8b55', 21, 43, 61, 3);
    block('#658a80', 24, 46, 55, 2);
  }
  if (complete[2]) {
    block('#584231', 27, 22, 27, 14);
    block('#315c58', 24, 19, 33, 4);
    block('#589789', 27, 17, 27, 2);
    block('#ffc574', 33, 25, 8, 7);
    block('#8b693f', 37, 25, 1, 7);
    block('#b18950', 45, 24, 5, 12);
  }
  if (complete[3]) {
    block('#c39a5d', 57, 28, 22, 2);
    block('#785947', 58, 31, 20, 5);
    block('#c56b4c', 59, 21, 18, 3);
    block('#ffba68', 60, 24, 3, 2);
    block('#ffba68', 72, 24, 3, 2);
  }
  if (complete[4]) {
    block('#76523d', 19, 26, 8, 10);
    block('#54796e', 18, 25, 9, 2);
    block('#ffc574', 21, 28, 3, 3);
  }
}
