import React, { useState } from "react";
import { Text, TextStyle, StyleProp } from "react-native";
import { WebView } from "react-native-webview";
import { colors } from "./theme";

// Detects whether a string contains real HTML markup (tags). Rich-text content
// authored in the admin editor is stored as HTML; older/plain content is not.
function looksLikeHtml(s: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(s);
}

// Renders lesson / assignment rich-text. If the value is HTML it is rendered
// (formatted, RTL-aware) inside an auto-height WebView; otherwise it falls back
// to a plain styled Text so we never show raw tags to the learner.
export default function HtmlContent({
  html,
  textStyle,
}: {
  html: string;
  textStyle?: StyleProp<TextStyle>;
}) {
  const [height, setHeight] = useState(48);

  if (!html || !looksLikeHtml(html)) {
    return <Text style={textStyle}>{html}</Text>;
  }

  const doc =
    '<!DOCTYPE html><html><head>' +
    '<meta charset="utf-8" />' +
    '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />' +
    "<style>" +
    "*{box-sizing:border-box;-webkit-text-size-adjust:100%;}" +
    "html,body{margin:0;padding:0;}" +
    'body{font-family:-apple-system,Roboto,"Segoe UI",sans-serif;font-size:15px;' +
    "line-height:1.7;color:" +
    colors.text +
    ";word-wrap:break-word;overflow-wrap:break-word;}" +
    "h1{font-size:20px;}h2{font-size:18px;}h3{font-size:16px;}" +
    "h1,h2,h3,h4{margin:14px 0 6px;font-weight:700;line-height:1.3;}" +
    "p{margin:8px 0;}" +
    "ul,ol{margin:8px 0;padding-inline-start:22px;}" +
    "li{margin:4px 0;}" +
    "strong,b{font-weight:700;}" +
    "a{color:" +
    colors.brand +
    ";}" +
    "img{max-width:100%;height:auto;border-radius:8px;}" +
    "</style></head><body>" +
    html +
    "<script>" +
    "function post(){var h=document.body.scrollHeight;" +
    "if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(String(h));}" +
    "window.addEventListener('load',post);setTimeout(post,300);setTimeout(post,800);" +
    "if(window.ResizeObserver){new ResizeObserver(post).observe(document.body);}" +
    "</script></body></html>";

  const sourceObj = { html: doc };
  const wvStyle = {
    width: "100%" as const,
    height,
    backgroundColor: "transparent",
  };

  return (
    <WebView
      originWhitelist={["*"]}
      source={sourceObj}
      style={wvStyle}
      scrollEnabled={false}
      showsVerticalScrollIndicator={false}
      onMessage={(e) => {
        const h = Number(e.nativeEvent.data);
        if (h && Math.abs(h - height) > 1) setHeight(h);
      }}
    />
  );
}
