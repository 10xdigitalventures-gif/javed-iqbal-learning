import React from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '../theme';

type Props = { route: { params: { url: string; title?: string } } };

function makeSource(url: string) {
  return { uri: url };
}

export default function WebViewScreen({ route }: Props) {
  const { url } = route.params;
  return (
    <View style={s.root}>
      <WebView
        source={makeSource(url)}
        style={s.web}
        startInLoadingState
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.card },
  web: { flex: 1 },
});
