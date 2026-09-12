import { PrismaClient, Role, OfficeLevel, ElectionStatus, GeoScopeType, NewsCategory } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ─── Country ──────────────────────────────────────────
  const nigeria = await prisma.country.upsert({
    where: { code: 'NG' },
    update: {},
    create: {
      name: 'Nigeria',
      code: 'NG',
    },
  });

  // ─── States ───────────────────────────────────────────
  const states = await Promise.all(
    [
      { name: 'Lagos' },
      { name: 'Abuja FCT' },
      { name: 'Rivers' },
      { name: 'Kano' },
    ].map((s) =>
      prisma.state.upsert({
        where: { name_countryId: { name: s.name, countryId: nigeria.id } },
        update: {},
        create: { name: s.name, countryId: nigeria.id },
      }),
    ),
  );

  const [lagos, abujaFct, rivers, kano] = states;

  // ─── LGAs ─────────────────────────────────────────────
  const lgas = await Promise.all([
    prisma.lGA.upsert({
      where: { name_stateId: { name: 'Ikeja', stateId: lagos.id } },
      update: {},
      create: { name: 'Ikeja', stateId: lagos.id },
    }),
    prisma.lGA.upsert({
      where: { name_stateId: { name: 'Surulere', stateId: lagos.id } },
      update: {},
      create: { name: 'Surulere', stateId: lagos.id },
    }),
    prisma.lGA.upsert({
      where: { name_stateId: { name: 'Municipal Area Council', stateId: abujaFct.id } },
      update: {},
      create: { name: 'Municipal Area Council', stateId: abujaFct.id },
    }),
    prisma.lGA.upsert({
      where: { name_stateId: { name: 'Port Harcourt', stateId: rivers.id } },
      update: {},
      create: { name: 'Port Harcourt', stateId: rivers.id },
    }),
    prisma.lGA.upsert({
      where: { name_stateId: { name: 'Nasarawa', stateId: kano.id } },
      update: {},
      create: { name: 'Nasarawa', stateId: kano.id },
    }),
  ]);

  // ─── Wards ────────────────────────────────────────────
  const wards = await Promise.all([
    prisma.ward.upsert({
      where: { name_lgaId: { name: 'Ojodu', lgaId: lgas[0].id } },
      update: {},
      create: { name: 'Ojodu', lgaId: lgas[0].id },
    }),
    prisma.ward.upsert({
      where: { name_lgaId: { name: 'Itire-Ikate', lgaId: lgas[1].id } },
      update: {},
      create: { name: 'Itire-Ikate', lgaId: lgas[1].id },
    }),
    prisma.ward.upsert({
      where: { name_lgaId: { name: 'Garki', lgaId: lgas[2].id } },
      update: {},
      create: { name: 'Garki', lgaId: lgas[2].id },
    }),
    prisma.ward.upsert({
      where: { name_lgaId: { name: 'Town', lgaId: lgas[3].id } },
      update: {},
      create: { name: 'Town', lgaId: lgas[3].id },
    }),
    prisma.ward.upsert({
      where: { name_lgaId: { name: 'Gwagwarwa', lgaId: lgas[4].id } },
      update: {},
      create: { name: 'Gwagwarwa', lgaId: lgas[4].id },
    }),
  ]);

  // ─── Communities ──────────────────────────────────────
  await Promise.all([
    prisma.community.upsert({
      where: { name_wardId: { name: 'Oke-Ira', wardId: wards[0].id } },
      update: {},
      create: { name: 'Oke-Ira', wardId: wards[0].id },
    }),
    prisma.community.upsert({
      where: { name_wardId: { name: 'Ijesha-Tedo', wardId: wards[1].id } },
      update: {},
      create: { name: 'Ijesha-Tedo', wardId: wards[1].id },
    }),
    prisma.community.upsert({
      where: { name_wardId: { name: 'Garki 2', wardId: wards[2].id } },
      update: {},
      create: { name: 'Garki 2', wardId: wards[2].id },
    }),
    prisma.community.upsert({
      where: { name_wardId: { name: 'Borokiri', wardId: wards[3].id } },
      update: {},
      create: { name: 'Borokiri', wardId: wards[3].id },
    }),
    prisma.community.upsert({
      where: { name_wardId: { name: 'Rijiyar Lemo', wardId: wards[4].id } },
      update: {},
      create: { name: 'Rijiyar Lemo', wardId: wards[4].id },
    }),
  ]);

  // ─── Parties ──────────────────────────────────────────
  const parties = await Promise.all([
    prisma.party.upsert({
      where: { acronym: 'APC' },
      update: {},
      create: {
        name: 'All Progressives Congress',
        acronym: 'APC',
        ideology: 'Conservatism, Nationalism',
        regionFocus: 'National',
      },
    }),
    prisma.party.upsert({
      where: { acronym: 'PDP' },
      update: {},
      create: {
        name: "People's Democratic Party",
        acronym: 'PDP',
        ideology: 'Centrism, Populism',
        regionFocus: 'National',
      },
    }),
    prisma.party.upsert({
      where: { acronym: 'LP' },
      update: {},
      create: {
        name: 'Labour Party',
        acronym: 'LP',
        ideology: 'Social Democracy',
        regionFocus: 'National',
      },
    }),
    prisma.party.upsert({
      where: { acronym: 'NNPP' },
      update: {},
      create: {
        name: 'New Nigeria Peoples Party',
        acronym: 'NNPP',
        ideology: 'Progressivism',
        regionFocus: 'National',
      },
    }),
  ]);

  // ─── Offices ──────────────────────────────────────────
  const offices = await Promise.all([
    prisma.office.upsert({
      where: { name: 'President' },
      update: {},
      create: { name: 'President', level: OfficeLevel.FEDERAL },
    }),
    prisma.office.upsert({
      where: { name: 'Governor' },
      update: {},
      create: { name: 'Governor', level: OfficeLevel.STATE },
    }),
    prisma.office.upsert({
      where: { name: 'Senator' },
      update: {},
      create: { name: 'Senator', level: OfficeLevel.FEDERAL },
    }),
    prisma.office.upsert({
      where: { name: 'Representative' },
      update: {},
      create: { name: 'Representative', level: OfficeLevel.FEDERAL },
    }),
  ]);

  // ─── Election ─────────────────────────────────────────
  await prisma.election.upsert({
    where: { id: 'seed-election-1' },
    update: {},
    create: {
      id: 'seed-election-1',
      name: '2027 General Elections',
      date: new Date('2027-02-20'),
      level: OfficeLevel.FEDERAL,
      geoScope: 'National',
      officesInvolved: offices.map((o) => o.id),
      status: ElectionStatus.UPCOMING,
    },
  });

  // ─── Users ────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('Admin@123', 10);
  const userPassword = await bcrypt.hash('User@123', 10);

  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@9jatruth.com' },
    update: {},
    create: {
      name: 'Super Admin',
      username: 'superadmin',
      email: 'admin@9jatruth.com',
      phone: '+2348000000000',
      passwordHash: adminPassword,
      roles: [Role.SUPER_ADMIN],
      verificationStatus: 'VERIFIED',
      countryId: nigeria.id,
      stateId: abujaFct.id,
    },
  });

  const testUser = await prisma.user.upsert({
    where: { email: 'user@9jatruth.com' },
    update: {},
    create: {
      name: 'Test User',
      username: 'testuser',
      email: 'user@9jatruth.com',
      phone: '+2348000000001',
      passwordHash: userPassword,
      roles: [Role.USER],
      verificationStatus: 'VERIFIED',
      countryId: nigeria.id,
      stateId: lagos.id,
      lgaId: lgas[0].id,
    },
  });

  // ─── Sample Posts ─────────────────────────────────────
  await prisma.post.upsert({
    where: { id: 'seed-post-1' },
    update: {},
    create: {
      id: 'seed-post-1',
      authorId: superAdmin.id,
      geoScopeType: GeoScopeType.NATIONAL,
      title: 'Welcome to 9jatruth',
      body: 'This is the official launch of the 9jatruth civic-politics platform. Join the conversation and hold your leaders accountable.',
      media: { images: [] },
      tags: ['announcement', 'launch'],
      truthScore: 100,
    },
  });

  await prisma.post.upsert({
    where: { id: 'seed-post-2' },
    update: {},
    create: {
      id: 'seed-post-2',
      authorId: testUser.id,
      geoScopeType: GeoScopeType.STATE,
      stateId: lagos.id,
      title: 'Lagos State Budget Allocation 2026',
      body: 'The Lagos State government has announced a budget allocation of 1.2 trillion naira for 2026, focusing on infrastructure and education.',
      media: { images: [] },
      tags: ['budget', 'lagos', 'governance'],
      truthScore: 85,
    },
  });

  await prisma.post.upsert({
    where: { id: 'seed-post-3' },
    update: {},
    create: {
      id: 'seed-post-3',
      authorId: testUser.id,
      geoScopeType: GeoScopeType.LGA,
      stateId: lagos.id,
      lgaId: lgas[0].id,
      title: 'Ikeja LGA Town Hall Meeting',
      body: 'A town hall meeting is scheduled for next week at the Ikeja LGA secretariat to discuss community development projects.',
      media: { images: [] },
      tags: ['town-hall', 'ikeja', 'community'],
      truthScore: 90,
    },
  });

  // ─── Sample News Article ─────────────────────────────
  await prisma.newsArticle.upsert({
    where: { url: 'https://example.com/news/sample-1' },
    update: {},
    create: {
      source: 'Vanguard',
      title: 'INEC announces voter registration timeline',
      description: 'The Independent National Electoral Commission has announced the timeline for continuous voter registration ahead of the 2027 general elections.',
      url: 'https://example.com/news/sample-1',
      imageUrl: 'https://example.com/images/inec.jpg',
      publishedAt: new Date(),
      geoScopeType: GeoScopeType.NATIONAL,
      category: NewsCategory.ELECTIONS,
      tags: ['INEC', 'elections', 'voter-registration'],
    },
  });

  console.log('Seed completed successfully!');
  console.log(`Super Admin: ${superAdmin.email} / Admin@123`);
  console.log(`Test User: ${testUser.email} / User@123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
