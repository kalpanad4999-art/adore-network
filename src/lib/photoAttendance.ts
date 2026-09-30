/** A replaceable, server-side recognition boundary. Never identify people in the browser. */
export type RecognitionResult = {
  recognizedIds: string[];
  unknownFaces: number;
};

export type RecognitionRequest = {
  batchId: string;
  date: string;
  photos: File[];
  memberIds: string[];
};

export interface PhotoRecognitionService {
  recognize(request: RecognitionRequest): Promise<RecognitionResult>;
}

/** No recognition provider is configured. Do not invent matches or silently mark anyone present. */
export const photoRecognitionService: PhotoRecognitionService = {
  async recognize() {
    throw new Error("Photo recognition is not connected. Review the batch photos and mark members manually.");
  },
};

export const uniqueBatchMatches = (result: RecognitionResult, memberIds: string[]): RecognitionResult => {
  const allowed = new Set(memberIds);
  return {
    recognizedIds: [...new Set(result.recognizedIds)].filter((id) => allowed.has(id)),
    unknownFaces: Math.max(0, Math.floor(result.unknownFaces)),
  };
};