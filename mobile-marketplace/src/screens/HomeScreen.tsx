import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, Image, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow } from '../theme';
import { getDirectory, ExpertCard } from '../api';
import { CATEGORIES } from '../categories';

function makeSource(url: string | undefined) {
  return url ? { uri: url } : undefined;
}

type Props = { navigation: any };

export default function HomeScreen({ navigation }: Props) {
  const [experts, setExperts] = useState<ExpertCard[]>([]);
  const [filtered, setFiltered] = useState<ExpertCard[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await getDirectory();
    setExperts(data);
    setFiltered(data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let result = experts;
    if (category !== 'All') result = result.filter(e => e.category === category);
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(e =>
        e.name.toLowerCase().includes(q) ||
        (e.tagline || '').toLowerCase().includes(q),
      );
    }
    setFiltered(result);
  }, [query, category, experts]);

  return (
    <View style={s.root}>
      {/* search bar */}
      <View style={s.searchRow}>
        <Ionicons name='search-outline' size={18} color={colors.muted} style={s.searchIcon} />
        <TextInput
          style={s.searchInput}
          placeholder='Search experts...'
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          returnKeyType='search'
        />
      </View>

      {/* category chips */}
      <FlatList
        data={CATEGORIES as unknown as string[]}
        keyExtractor={i => i}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chips}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setCategory(item)}
            style={[s.chip, item === category && s.chipActive]}
            activeOpacity={0.7}
          >
            <Text style={[s.chipText, item === category && s.chipTextActive]}>
              {item}
            </Text>
          </TouchableOpacity>
        )}
      />

      {loading ? (
        <ActivityIndicator style={s.loader} color={colors.brand} size='large' />
      ) : filtered.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyText}>No experts found</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={e => e.id}
          contentContainerStyle={s.list}
          numColumns={2}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={colors.brand}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.card}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('ExpertDetail', { slug: item.slug })}
            >
              {item.logoUrl ? (
                <Image source={makeSource(item.logoUrl)} style={s.logo} resizeMode='cover' />
              ) : (
                <View style={s.logoPlaceholder}>
                  <Text style={s.logoInitial}>{(item.name || '?')[0].toUpperCase()}</Text>
                </View>
              )}
              {item.category ? (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{item.category}</Text>
                </View>
              ) : null}
              <Text style={s.expertName} numberOfLines={1}>{item.name}</Text>
              {item.tagline ? (
                <Text style={s.tagline} numberOfLines={2}>{item.tagline}</Text>
              ) : null}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const CARD_PADDING = 12;
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    margin: 16,
    borderRadius: radius.xl,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 44, color: colors.text, fontSize: 15 },
  chips: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  loader: { marginTop: 60 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.muted, fontSize: 15 },
  list: { paddingHorizontal: CARD_PADDING, paddingBottom: 32, gap: CARD_PADDING },
  card: {
    flex: 1,
    margin: CARD_PADDING / 2,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    ...shadow,
  },
  logo: { width: '100%', height: 80, borderRadius: radius.md, marginBottom: 10 },
  logoPlaceholder: {
    width: '100%',
    height: 80,
    borderRadius: radius.md,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  logoInitial: { fontSize: 28, fontWeight: '800', color: colors.brand },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.brandLight,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 6,
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: colors.brand },
  expertName: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4 },
  tagline: { fontSize: 12, color: colors.muted, lineHeight: 16 },
});
