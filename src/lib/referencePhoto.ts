import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";

let detectorPromise: Promise<FaceDetector> | null = null;

const detector = () => {
  detectorPromise ??= (async () => {
    const wasm = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm");
    return FaceDetector.createFromOptions(wasm, {
      baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite" },
      runningMode: "IMAGE", minDetectionConfidence: 0.6,
    });
  })().catch((error) => { detectorPromise = null; throw error; });
  return detectorPromise;
};

/** Checks reference-photo suitability locally; pixels never leave the device. This does not identify anyone. */
export async function validateReferencePhoto(file: File): Promise<void> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
    throw new Error("Choose a JPG, PNG or WEBP photo under 5 MB");
  }
  let image: ImageBitmap | undefined;
  try {
    image = await createImageBitmap(file);
    if (image.width < 320 || image.height < 320) throw new Error("Photo is too small. Use a clearer photo of one face.");
    const result = (await detector()).detect(image);
    if (result.detections.length === 0) throw new Error("No clear face detected. Please retake or choose another photo.");
    if (result.detections.length > 1) throw new Error("Multiple faces detected. Use a photo of only this member.");
    const face = result.detections[0].boundingBox;
    if (!face || face.width < 80 || face.height < 80) throw new Error("Face is too small. Move closer and try again.");
  } catch (error) {
    if (error instanceof Error && /face|photo|JPG/.test(error.message)) throw error;
    throw new Error("Face check unavailable. Please try again when connected; no photo was saved.");
  } finally { image?.close(); }
}