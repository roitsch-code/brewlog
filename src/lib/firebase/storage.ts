import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import app from "./config";

export const storage = getStorage(app);

export async function uploadImage(file: File, path: string): Promise<{ url: string; storagePath: string }> {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return { url, storagePath: path };
}

export async function deleteImage(storagePath: string): Promise<void> {
  await deleteObject(ref(storage, storagePath));
}
