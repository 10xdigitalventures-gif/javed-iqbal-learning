import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow } from '../theme';
import { getTenantBySlug, getTenantCatalog, TenantPublic } from '../api';

function makeSource(url: string | undefined) {
  return url ? { uri: url } : undefined;
}

type Props = { navigation: any; route: { params: { slug: string } } };

export default function ExpertDetailScreen({ navigation, route }: Props) {
  const { slug } = route.params;
  const [tenant, setTenant] = useState<TenantPublic | null>(null);
  const [catalog, setCatalog] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getTenantBySlug(slug), getTenantCatalog(slug)])
      .then(([t, c]) => { setTenant(t); setCatalog(c || {}); })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.brand} size='large' />
      </View>
    );
  }
  if (!tenant) {
    return (
      <View style={s.center}>
        <Text style={s.errorText}>Expert not found</Text>
      </View>
    );
  }

  const primary = tenant.primaryColor || colors.brand;
  const courses: any[] = catalog.courses || [];
  const packages: any[] = catalog.packages || [];

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      {/* hero */}
      <View style={[s.hero, { backgroundColor: primary + '22' }]}>
        {tenant.logoUrl ? (
          <Image source={makeSource(tenant.logoUrl)} style={s.logo} resizeMode='contain' />
        ) : (
          <View style={[s.logoFallback, { backgroundColor: primary + '33' }]}>
            <Text style={[s.logoLetter, { color: primary }]}>
              {(tenant.name || '?')[0].toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={s.name}>{tenant.name}</Text>
        {tenant.tagline ? <Text style={s.tagline}>{tenant.tagline}</Text> : null}
        {tenant.category ? (
          <View style={[s.catBadge, { backgroundColor: primary + '22' }]}>
            <Text style={[s.catText, { color: primary }]}>{tenant.category}</Text>
          </View>
        ) : null}
      </View>

      {/* visit storefront CTA */}
      <TouchableOpacity
        style={[s.cta, { backgroundColor: primary }]}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('WebView', {
          url: tenant.subdomainUrl,
          title: tenant.name,
        })}
      >
        <Ionicons name='open-outline' size={18} color='#fff' style={s.ctaIcon} />
        <Text style={s.ctaText}>Visit {tenant.name}</Text>
      </TouchableOpacity>

      {/* courses */}
      {courses.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Courses</Text>
          {courses.slice(0, 6).map((c: any) => (
            <View key={c.id} style={s.item}>
              <View style={s.itemBody}>
                <Text style={s.itemTitle} numberOfLines={1}>{c.title}</Text>
                {c.description ? (
                  <Text style={s.itemDesc} numberOfLines={2}>{c.description}</Text>
                ) : null}
              </View>
              {c.price != null && (
                <Text style={[s.price, { color: primary }]}>
                  {c.currency || 'PKR'} {c.price}
                </Text>
              )}
            </View>
          ))}
        </>
      )}

      {/* packages */}
      {packages.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Consultation packages</Text>
          {packages.map((p: any) => (
            <View key={p.id} style={s.item}>
              <View style={s.itemBody}>
                <Text style={s.itemTitle} numberOfLines={1}>{p.name}</Text>
                <Text style={s.itemDesc} numberOfLines={1}>
                  {p.type} · {p.billingDays} days
                </Text>
              </View>
              <Text style={[s.price, { color: primary }]}>
                {p.currency || 'PKR'} {p.price}
              </Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.muted, fontSize: 16 },
  hero: { alignItems: 'center', padding: 28, marginBottom: 16 },
  logo: { width: 100, height: 100, borderRadius: radius.xl, marginBottom: 14 },
  logoFallback: {
    width: 100,
    height: 100,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  logoLetter: { fontSize: 40, fontWeight: '900' },
  name: { fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center' },
  tagline: { fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 4 },
  catBadge: {
    marginTop: 10,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  catText: { fontSize: 12, fontWeight: '700' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: radius.xl,
    paddingVertical: 14,
    ...shadow,
  },
  ctaIcon: { marginRight: 8 },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 10,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: radius.md,
    padding: 14,
    ...shadow,
  },
  itemBody: { flex: 1, marginRight: 10 },
  itemTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  itemDesc: { fontSize: 12, color: colors.muted, marginTop: 2 },
  price: { fontSize: 13, fontWeight: '700' },
});
