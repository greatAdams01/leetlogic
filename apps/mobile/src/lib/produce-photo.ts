import * as ImagePicker from "expo-image-picker";
import { File, Paths } from "expo-file-system";
import { randomUUID } from "expo-crypto";
const limit = 10 * 1024 * 1024;
/** The picker exports base64 as JPEG on iOS and Android, including HEIC sources.
 * Its URI and mimeType can still describe the original format, so upload the
 * exported JPEG from a private cache file instead of relabelling the original.
 */
export async function choosePhoto(camera = false) {
  const permission = camera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      camera
        ? "Camera permission was denied. Choose a photo from your library or enable camera access in Settings."
        : "Photo access was denied. Enable it in Settings to attach produce.",
    );
  const result = await (
    camera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync
  )({
    mediaTypes: ["images"],
    quality: 0.8,
    allowsEditing: false,
    base64: true,
  });
  if (result.canceled) return null;
  const photo = result.assets[0];
  if (!photo?.base64 || !photo.base64.startsWith("/9j/"))
    throw new Error("We couldn’t prepare this photo. Choose another image and try again.");
  const size =
    Math.floor((photo.base64.length * 3) / 4) -
    (photo.base64.endsWith("==") ? 2 : photo.base64.endsWith("=") ? 1 : 0);
  if (!size || size > limit) throw new Error("Choose a photo smaller than 10 MB.");
  const file = new File(Paths.cache, `produce-${randomUUID()}.jpg`);
  try {
    file.create();
    file.write(photo.base64, { encoding: "base64" });
    if (!file.size || file.size > limit) throw new Error("Choose a photo smaller than 10 MB.");
  } catch (error) {
    if (file.exists) file.delete();
    if (error instanceof Error && error.message === "Choose a photo smaller than 10 MB.")
      throw error;
    throw new Error("We couldn’t prepare this photo. Choose another image and try again.");
  }
  return {
    ...photo,
    uri: file.uri,
    mimeType: "image/jpeg",
    fileName: file.name,
    fileSize: file.size,
    base64: undefined,
  };
}
/** Read the native file directly: no file-URL fetch, RN Blob or FileReader bridge. */
export async function photoBody(uri: string, mime = "image/jpeg") {
  let bytes: Uint8Array;
  try {
    const file = new File(uri);
    if (!file.exists) throw new Error("Missing file");
    if (file.size > limit) throw new Error("Too large");
    bytes = await file.bytes();
  } catch (error) {
    if (error instanceof Error && error.message === "Too large")
      throw new Error("Choose a photo smaller than 10 MB.");
    throw new Error("We couldn’t read this photo. Select it again and retry.");
  }
  if (!bytes.byteLength || bytes.byteLength > limit)
    throw new Error("Choose a photo smaller than 10 MB.");
  return { bytes, contentType: mime };
}
