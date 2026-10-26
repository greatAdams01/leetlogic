import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, View } from "react-native";
import { File, Paths } from "expo-file-system";
import { randomUUID } from "expo-crypto";
import { api, sessionVersion } from "../lib/api";
import { type Listing } from "../lib/domain";
import { useApp } from "../state";
import { Icon, Label, colors } from "./ui";
/** Fetch through the session-aware API, then let the native Image read a local
 * file. Native remote-image requests do not participate in token refresh. */
export function ListingPhoto({ item, height = 200 }: { item: Listing; height?: number }) {
  const a = useApp();
  const id = item.media
    ?.find((media) => /^produce\/[a-f0-9-]{36}$/i.test(media.objectKey))
    ?.objectKey.split("/")[1];
  const identity = sessionVersion();
  const [uri, setUri] = useState<string | null>(null),
    [failed, setFailed] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let file: File | undefined;
    setUri(null);
    setFailed(false);
    if (id)
      void (async () => {
        try {
          const result = await api<{ bytes: Uint8Array; mime: string }>(`/listing-photos/${id}`, {
            imageResponse: true,
          });
          if (cancelled) return;
          file = new File(
            Paths.cache,
            `listing-preview-${randomUUID()}.${result.mime === "image/png" ? "png" : "jpg"}`,
          );
          file.create();
          file.write(result.bytes);
          if (!cancelled) setUri(file.uri);
        } catch (error) {
          if (!cancelled) {
            setFailed(true);
            if (typeof __DEV__ !== "undefined" && __DEV__) {
              const failure = error as { code?: string; status?: number; requestId?: string };
              console.warn("[LeetLogic photo preview failed]", {
                code: failure.code,
                status: failure.status,
                requestId: failure.requestId,
              });
            }
          }
        }
      })();
    return () => {
      cancelled = true;
      try {
        if (file?.exists) file.delete();
      } catch {
        /* OS cache cleanup can remove an unused preview. */
      }
    };
  }, [id, identity, revision]);
  return (
    <View
      style={{
        height,
        width: "100%",
        borderRadius: 14,
        overflow: "hidden",
        backgroundColor: colors.mint,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {uri && !failed ? (
        <Image
          source={{ uri }}
          accessibilityLabel={item.title}
          resizeMode="cover"
          style={{ width: "100%", height: "100%" }}
          onError={() => setFailed(true)}
        />
      ) : !id || failed ? (
        <>
          <Icon name="leaf" size={height < 100 ? 20 : 40} />
          {height >= 100 && <Label muted>Photo unavailable</Label>}
          {id && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={a.ui("Retry photo")}
              style={{ minHeight: 44, padding: 8, justifyContent: "center" }}
              onPress={() => setRevision((value) => value + 1)}
            >
              <Label style={{ fontSize: 12, color: colors.green }}>Retry photo</Label>
            </Pressable>
          )}
        </>
      ) : (
        <ActivityIndicator color={colors.green} accessibilityLabel={a.ui("Loading photo…")} />
      )}
    </View>
  );
}
