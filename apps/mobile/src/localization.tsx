import React, { createContext, useContext } from "react";
import { Text as NativeText, type TextProps } from "react-native";
import { ui, type Locale } from "./lib/localization";
const Context = createContext<Locale>("en");
export const LocaleProvider = Context.Provider;
export const useLocale = () => useContext(Context);
export const useUI = () => {
  const locale = useLocale();
  return (source: string, params?: Record<string, string | number>) => ui(locale, source, params);
};
function translateChildren(locale: Locale, children: React.ReactNode): React.ReactNode {
  if (typeof children === "string") return ui(locale, children);
  if (Array.isArray(children)) return children.map((child) => translateChildren(locale, child));
  return children;
}
/** Translate interface copy at text boundaries; unknown resource values stay intact. */
export function LocalizedText({ children, accessibilityLabel, ...props }: TextProps) {
  const locale = useLocale();
  return (
    <NativeText
      {...props}
      accessibilityLabel={accessibilityLabel ? ui(locale, accessibilityLabel) : undefined}
    >
      {translateChildren(locale, children)}
    </NativeText>
  );
}
