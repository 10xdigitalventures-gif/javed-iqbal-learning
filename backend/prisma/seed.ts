import {
  PrismaClient,
  PackageType,
  PackageChannel,
  Role,
  AccessType,
  SubscriptionInterval,
  EntitlementSource,
} from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("Password123!", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      password,
      name: "Platform Admin",
      role: Role.ADMIN,
    },
  });

  const consultant = await prisma.user.upsert({
    where: { email: "consultant@example.com" },
    update: {},
    create: {
      email: "consultant@example.com",
      password,
      name: "Dr. Ayesha Khan",
      role: Role.CONSULTANT,
      title: "Business & Career Mentor",
      expertise: "Career coaching, Startups, Leadership",
      bio: "15+ years mentoring founders and professionals.",
    },
  });

  const consultant2 = await prisma.user.upsert({
    where: { email: "consultant2@example.com" },
    update: {},
    create: {
      email: "consultant2@example.com",
      password,
      name: "Bilal Ahmed",
      role: Role.CONSULTANT,
      title: "Financial Advisor",
      expertise: "Personal finance, Investments",
      bio: "Helping clients build wealth with sound planning.",
    },
  });

  const client = await prisma.user.upsert({
    where: { email: "client@example.com" },
    update: {},
    create: {
      email: "client@example.com",
      password,
      name: "Sara Malik",
      role: Role.CLIENT,
    },
  });

  // ---------------------------------------------------------------------------
  // Fresh package structure.
  //
  // We wipe the old plans (and the purchase/payment data that depends on them)
  // and re-seed sample plans that demonstrate the new per-channel structure.
  //
  // Usage convention used throughout the platform:
  //   - null  limit = unlimited for that channel
  //   - 0     limit = channel NOT allowed by this plan
  //   - n > 0 limit = n units allowed for that channel
  // ---------------------------------------------------------------------------
  await prisma.payment.deleteMany({});
  await prisma.message.updateMany({
    where: { purchaseId: { not: null } },
    data: { purchaseId: null },
  });
  await prisma.meeting.updateMany({
    where: { purchaseId: { not: null } },
    data: { purchaseId: null },
  });
  await prisma.purchase.deleteMany({});
  await prisma.package.deleteMany({});

  // 1) Text-only plan — assigned to Dr. Ayesha Khan.
  await prisma.package.create({
    data: {
      name: "Text Coaching (Starter)",
      description:
        "Chat-based coaching. 50 text messages — audio and video are not included.",
      type: PackageType.ONE_TIME,
      channel: PackageChannel.TEXT,
      price: 2500,
      currency: "PKR",
      textLimit: 50,
      audioLimit: 0,
      videoLimit: 0,
      sessionLimit: 0,
      responseAllowance: 50,
      billingDays: null,
      isGlobal: false,
      consultants: { connect: [{ id: consultant.id }] },
    },
  });

  // 2) Audio-only plan — assigned to Dr. Ayesha Khan.
  await prisma.package.create({
    data: {
      name: "Audio Mentorship",
      description:
        "Voice-note mentorship. 12 audio messages (90s each). Text and video not included.",
      type: PackageType.MONTHLY,
      channel: PackageChannel.AUDIO,
      price: 6000,
      currency: "PKR",
      textLimit: 0,
      audioLimit: 12,
      videoLimit: 0,
      sessionLimit: 0,
      audioDuration: 90,
      billingDays: 30,
      isGlobal: false,
      consultants: { connect: [{ id: consultant.id }] },
    },
  });

  // 3) Video-only plan — assigned to Bilal Ahmed.
  await prisma.package.create({
    data: {
      name: "Video Sessions",
      description:
        "Face-to-face guidance. 6 video messages (120s each) plus 4 live sessions. No text or audio.",
      type: PackageType.MONTHLY,
      channel: PackageChannel.VIDEO,
      price: 12000,
      currency: "PKR",
      textLimit: 0,
      audioLimit: 0,
      videoLimit: 6,
      sessionLimit: 4,
      sessionDuration: 45,
      videoDuration: 120,
      billingDays: 30,
      isGlobal: false,
      consultants: { connect: [{ id: consultant2.id }] },
    },
  });

  // 4) Combined plan — GLOBAL (offered by every consultant). Unlimited text.
  await prisma.package.create({
    data: {
      name: "All-Access Mentorship (Combined)",
      description:
        "Everything included: unlimited text, generous audio and video, plus monthly live sessions. Available with any consultant.",
      type: PackageType.ANNUAL,
      channel: PackageChannel.COMBINED,
      price: 80000,
      currency: "PKR",
      textLimit: null, // unlimited
      audioLimit: 96,
      videoLimit: 96,
      sessionLimit: 24,
      sessionDuration: 60,
      audioDuration: 120,
      videoDuration: 120,
      responseAllowance: null,
      billingDays: 365,
      isGlobal: true,
    },
  });

  // Availability for the first consultant (Mon-Fri 9-5)
  const existingAvail = await prisma.availability.count({
    where: { consultantId: consultant.id },
  });
  if (existingAvail === 0) {
    await prisma.availability.createMany({
      data: [1, 2, 3, 4, 5].map((weekday) => ({
        consultantId: consultant.id,
        weekday,
        startTime: "09:00",
        endTime: "17:00",
      })),
    });
  }

  // A free community
  const existing = await prisma.community.findFirst({
    where: { name: "Founders Circle" },
  });
  if (!existing) {
    const community = await prisma.community.create({
      data: {
        name: "Founders Circle",
        description: "A community for founders to share wins and get advice.",
        isPaid: false,
        currency: "PKR",
      },
    });
    await prisma.communityMember.createMany({
      data: [
        { communityId: community.id, userId: consultant.id, isModerator: true },
        { communityId: community.id, userId: client.id },
      ],
      skipDuplicates: true,
    });
    await prisma.communityPost.create({
      data: {
        communityId: community.id,
        authorId: consultant.id,
        body: "Welcome to the Founders Circle! Introduce yourself below 👋",
        isAnnouncement: true,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Prof. Dr. Javed Iqbal Learning Platform — Phase 1 (Books) demo content.
  // ---------------------------------------------------------------------------
  const categorySeeds = [
    { name: "Philosophy", icon: "🧠", sortOrder: 1 },
    { name: "Psychology", icon: "💡", sortOrder: 2 },
    { name: "Self Development", icon: "🌱", sortOrder: 3 },
    { name: "Spirituality", icon: "🕊️", sortOrder: 4 },
  ];
  const categoryByName: Record<string, string> = {};
  for (const c of categorySeeds) {
    const slug = c.name.toLowerCase().replace(/\s+/g, "-");
    const cat = await prisma.bookCategory.upsert({
      where: { slug },
      update: { name: c.name, icon: c.icon, sortOrder: c.sortOrder },
      create: { name: c.name, slug, icon: c.icon, sortOrder: c.sortOrder },
    });
    categoryByName[c.name] = cat.id;
  }

  const cover = (label: string) =>
    `https://placehold.co/400x600/FF7A1A/FFFFFF?text=` +
    encodeURIComponent(label);

  const bookSeeds = [
    {
      slug: "the-art-of-thinking",
      title: "The Art of Thinking",
      category: "Philosophy",
      price: 1500,
      accessType: AccessType.LIFETIME,
      isFeatured: true,
      allowHardCopy: true,
      hardCopyPrice: 2500,
      description:
        "A foundational guide to clear reasoning, reflection and decision-making.",
      chapters: [
        "Introduction",
        "Mental Models",
        "Logic & Fallacies",
        "Reflective Practice",
      ],
    },
    {
      slug: "mind-and-meaning",
      title: "Mind and Meaning",
      category: "Psychology",
      price: 1800,
      accessType: AccessType.SUBSCRIPTION,
      isFeatured: true,
      description:
        "How the mind constructs meaning, and how to align it with purpose.",
      chapters: ["The Conscious Mind", "Emotion & Reason", "Finding Meaning"],
    },
    {
      slug: "paths-to-growth",
      title: "Paths to Growth",
      category: "Self Development",
      price: 1200,
      accessType: AccessType.LIFETIME,
      description: "Practical frameworks for lifelong personal growth.",
      chapters: ["Habits", "Discipline", "Resilience", "Mastery"],
    },
    {
      slug: "inner-peace",
      title: "Inner Peace",
      category: "Spirituality",
      price: 1000,
      accessType: AccessType.SUBSCRIPTION,
      description: "A calm, reflective approach to a balanced inner life.",
      chapters: ["Stillness", "Gratitude", "Letting Go"],
    },
    {
      slug: "foundations-of-wisdom",
      title: "Foundations of Wisdom",
      category: "Philosophy",
      price: 2000,
      accessType: AccessType.LIFETIME,
      isFeatured: true,
      allowHardCopy: true,
      hardCopyPrice: 3000,
      description: "Timeless principles for living wisely and well.",
      chapters: ["Knowledge", "Virtue", "Justice", "The Good Life"],
    },
  ];

  const bookIdBySlug: Record<string, string> = {};
  for (const b of bookSeeds) {
    const book = await prisma.book.upsert({
      where: { slug: b.slug },
      update: {
        title: b.title,
        description: b.description,
        price: b.price,
        categoryId: categoryByName[b.category],
        accessType: b.accessType,
        isFeatured: b.isFeatured ?? false,
        allowHardCopy: b.allowHardCopy ?? false,
        hardCopyPrice: b.hardCopyPrice ?? null,
      },
      create: {
        title: b.title,
        slug: b.slug,
        author: "Prof. Dr. Javed Iqbal",
        description: b.description,
        coverUrl: cover(b.title),
        language: "en",
        pageCount: b.chapters.length * 20,
        categoryId: categoryByName[b.category],
        price: b.price,
        currency: "PKR",
        allowHardCopy: b.allowHardCopy ?? false,
        hardCopyPrice: b.hardCopyPrice ?? null,
        accessType: b.accessType,
        isFeatured: b.isFeatured ?? false,
        isPublished: true,
        contentKey: `books/${b.slug}/content`,
        previewContentKey: `books/${b.slug}/preview`,
      },
    });
    bookIdBySlug[b.slug] = book.id;
    for (let i = 0; i < b.chapters.length; i++) {
      const index = i + 1;
      await prisma.chapter.upsert({
        where: { bookId_index: { bookId: book.id, index } },
        update: { title: b.chapters[i] },
        create: {
          bookId: book.id,
          index,
          title: b.chapters[i],
          contentKey: `books/${b.slug}/ch${index}`,
          pageStart: i * 20 + 1,
          pageEnd: i * 20 + 20,
        },
      });
    }
  }

  // A featured bundle that groups several titles at a discount.
  const bundle = await prisma.bundle.upsert({
    where: { slug: "complete-collection" },
    update: { price: 4500, isFeatured: true, isPublished: true },
    create: {
      title: "Complete Collection",
      slug: "complete-collection",
      description: "All five foundational titles in one discounted bundle.",
      coverUrl: cover("Bundle"),
      price: 4500,
      currency: "PKR",
      isFeatured: true,
      isPublished: true,
    },
  });
  await prisma.bundleItem.deleteMany({ where: { bundleId: bundle.id } });
  for (const slug of [
    "the-art-of-thinking",
    "mind-and-meaning",
    "paths-to-growth",
    "inner-peace",
    "foundations-of-wisdom",
  ]) {
    await prisma.bundleItem.create({
      data: { bundleId: bundle.id, bookId: bookIdBySlug[slug] },
    });
  }

  // Admin-configurable subscription plans.
  const planSeeds = [
    {
      name: "Monthly",
      interval: SubscriptionInterval.MONTHLY,
      durationDays: 30,
      price: 999,
    },
    {
      name: "6 Months",
      interval: SubscriptionInterval.SIX_MONTHS,
      durationDays: 182,
      price: 4999,
    },
    {
      name: "1 Year",
      interval: SubscriptionInterval.YEARLY,
      durationDays: 365,
      price: 8999,
    },
    {
      name: "Lifetime",
      interval: SubscriptionInterval.LIFETIME,
      durationDays: null,
      price: 24999,
    },
  ];
  for (const p of planSeeds) {
    const data = {
      name: p.name,
      description: `${p.name} access to all subscription titles and future courses.`,
      interval: p.interval,
      durationDays: p.durationDays,
      price: p.price,
      currency: "PKR",
      isActive: true,
      features: JSON.stringify([
        "All subscription books",
        "Reading progress sync",
        "Offline secure reading",
      ]),
    };
    const existingPlan = await prisma.subscriptionPlan.findFirst({
      where: { name: p.name },
    });
    if (existingPlan) {
      await prisma.subscriptionPlan.update({
        where: { id: existingPlan.id },
        data,
      });
    } else {
      await prisma.subscriptionPlan.create({ data });
    }
  }

  // Give the demo client one owned book with some reading progress so the
  // "My Books" and "Continue reading" screens have content out of the box.
  const ownedBookId = bookIdBySlug["the-art-of-thinking"];
  await prisma.entitlement.upsert({
    where: { userId_bookId: { userId: client.id, bookId: ownedBookId } },
    update: { isActive: true, source: EntitlementSource.PURCHASE },
    create: {
      userId: client.id,
      bookId: ownedBookId,
      source: EntitlementSource.PURCHASE,
    },
  });
  await prisma.readingProgress.upsert({
    where: { userId_bookId: { userId: client.id, bookId: ownedBookId } },
    update: {
      lastChapterIndex: 2,
      lastPage: 14,
      percentComplete: 35,
      chaptersCompleted: 1,
      readingSeconds: 3600,
      lastReadAt: new Date(),
    },
    create: {
      userId: client.id,
      bookId: ownedBookId,
      lastChapterIndex: 2,
      lastPage: 14,
      percentComplete: 35,
      chaptersCompleted: 1,
      readingSeconds: 3600,
    },
  });

  // Platform settings defaults
  await prisma.platformSetting.upsert({
    where: { key: "platformName" },
    update: {},
    create: { key: "platformName", value: "Consultant & Mentorship Platform" },
  });

  console.log("Seed complete:");
  console.log({
    admin: admin.email,
    consultant: consultant.email,
    consultant2: consultant2.email,
    client: client.email,
  });
  console.log(
    "Plans: Text Coaching, Audio Mentorship, Video Sessions, All-Access (global)",
  );
  console.log(
    `Learning content: ${bookSeeds.length} books, 1 bundle, ${planSeeds.length} subscription plans`,
  );
  console.log("All demo passwords: Password123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
