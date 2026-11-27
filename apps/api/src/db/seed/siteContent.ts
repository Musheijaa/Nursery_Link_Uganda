/**
 * Site copy and Expert Services from the client's "Platform Content Adjustment Brief" (November 2026),
 * word for word. Seeded once; admins edit it in the console (Page content, Expert services) afterwards.
 */

export interface SeedPageContent {
  key: string;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  data: Record<string, unknown>;
}

const paragraphs = (...lines: string[]) => lines.join('\n\n');

export const PAGE_CONTENT: SeedPageContent[] = [
  {
    key: 'home.hero',
    title: 'Welcome to Nursery Link Uganda!',
    subtitle: 'Your Link to Quality Seedlings.',
    body: paragraphs(
      'Finding the right tree seedlings starts here.\nWe connect farmers, individuals, organizations and institutions with nurseries, making it easier to discover suppliers, explore tree species and connect directly with nursery operators.',
      'Whether you are planting for income, agroforestry, environmental conservation or landscape restoration, Nursery Link Uganda helps you find the seedlings and connections you need.',
      'Find the seedlings you need. Connect with nurseries. Grow a greener future.'
    ),
    data: { eyebrow: 'NURSERY LINK UGANDA' },
  },
  {
    key: 'home.how_it_works',
    title: 'Getting seedlings is easy!',
    subtitle: null,
    body: null,
    data: {
      steps: [
        { title: 'Choose Your District and Sub-county', body: 'Select your district and sub-county from the available dropdown lists.' },
        { title: 'Choose a Nursery', body: 'Explore nurseries in your area and check the tree seedlings they offer.' },
        { title: 'Contact the Nursery Operator', body: 'Click the phone number on the nursery profile to call the operator and discuss your order.' },
        {
          title: 'Collect or Arrange Delivery',
          body: 'Agree with the nursery operator on whether to collect the seedlings yourself or have them delivered.',
        },
      ],
    },
  },
  {
    key: 'home.partners',
    title: 'Our Partners and Supporters',
    subtitle: null,
    body: 'We welcome partnerships with organizations, institutions and individuals committed to advancing tree growing, agroforestry and landscape restoration in Uganda.',
    data: {},
  },
  {
    key: 'library.intro',
    title: 'WELCOME TO THE DIGITAL TREE LIBRARY',
    subtitle: 'Learn Before You Plant. Choose the Right Tree for the Right Purpose.',
    body: paragraphs(
      'The Tree Library provides accessible information to help you identify, understand and select different tree species.',
      'Whether you are planting for commercial timber, fruit production, food security, crop shade, agroforestry or ecosystem conservation, we help you understand the characteristics, uses and growing requirements of different tree species before making your planting decisions.',
      'Explore tree species and make informed choices for your land, farming needs and environmental goals.'
    ),
    data: {},
  },
  {
    key: 'expert_services.intro',
    title: 'WELCOME TO EXPERT SERVICES',
    subtitle: 'Professional Expertise from Farm Assessment to Landscape Restoration and Monitoring.',
    body: paragraphs(
      'Nursery Link Uganda goes beyond connecting people to tree seedlings. Through our Expert Services section, we aim to connect farmers, plantation investors, organizations and development projects with relevant technical expertise in forestry, agriculture, environmental management and geospatial technologies.',
      'Whether you need support in designing an agroforestry system, establishing a commercial woodlot, mapping farm boundaries, monitoring tree growth or planning a restoration project, explore the technical services available through our platform.'
    ),
    data: {},
  },
  {
    key: 'news.intro',
    title: 'WELCOME TO NEWS & UPDATES',
    subtitle: 'Stay Informed. Stay Connected. Keep Growing.',
    body: paragraphs(
      'The News & Updates section is an information and knowledge-sharing space for nursery operators, farmers, forestry professionals, restoration organizations and other stakeholders.',
      'Get relevant updates on forestry, agroforestry, tree growing, environmental conservation and landscape restoration in Uganda.',
      'Explore sector developments, government programmes, funding opportunities, seasonal planting information, training announcements and other useful updates to help you make informed decisions.'
    ),
    data: {},
  },
  {
    key: 'giveaways.intro',
    title: 'DISCOVER FREE AND SUBSIDISED SEEDLING OPPORTUNITIES ACROSS UGANDA',
    subtitle: null,
    body: paragraphs(
      'Access information about tree seedling distribution programmes, government initiatives, NGO-supported campaigns and other opportunities that help farmers, communities and organizations obtain planting materials.',
      'Nursery Link Uganda aims to bring information about these opportunities together in one accessible space, helping potential beneficiaries discover relevant programmes and understand how to participate.',
      'Explore available campaigns, check eligibility requirements and follow the application or distribution instructions provided by the respective programme organizers.'
    ),
    data: {},
  },
  {
    key: 'donate.page',
    title: 'SUPPORT NURSERY LINK UGANDA',
    subtitle: 'Help Build the Digital Infrastructure Connecting People to Quality Seedlings.',
    body: paragraphs(
      'Thank you for considering supporting Nursery Link Uganda.',
      'Nursery Link Uganda is a youth-led, technology-driven initiative working to improve access to tree seedlings by connecting nursery operators with farmers, individuals, organizations and institutions.\nWe believe that better access to nursery information and seedling suppliers can strengthen tree-growing initiatives, support nursery businesses and contribute to landscape restoration across Uganda.',
      '## How Your Support Makes a Difference',
      'Contributions will support four main priority areas:',
      '### 1. Digital Infrastructure',
      '- Website hosting and platform development.\n- Google Maps and Web-GIS integration.\n- Spatial database security and reliability.',
      '### 2. Nursery Mapping & Verification',
      '- Mapping nursery GPS coordinates across Uganda.\n- Documenting species inventories, prices and stock numbers.\n- Expanding the directory into additional districts.',
      '### 3. Operator Onboarding & Training',
      '- Registering smallholder and community nursery operators.\n- Training operators on profile and stock management.\n- Supporting digital literacy among rural nursery operators.',
      '### 4. Community Outreach',
      '- Awareness campaigns targeting local farmers and restoration organizations.\n- Partnerships with forestry and youth-led environmental institutions.\n- Expanding the platform into additional regions.',
      '## Ways to Support Us',
      'We welcome financial contributions, technical assistance, equipment and institutional partnerships from:',
      '- Individuals and well-wishers.\n- Private companies and corporate sponsors.\n- NGOs and development partners.\n- Government institutions.',
      '## Be Part of the Growing Network',
      'Your contribution helps us connect more nurseries, reach more communities and improve access to quality planting materials.\nHelp us grow a greener future.'
    ),
    data: {},
  },
  // Set by an admin (MoMo number, bank details): never written into the code. Hidden until filled in.
  { key: 'donate.payment_instructions', title: 'How to send a donation', subtitle: null, body: null, data: {} },
  { key: 'site.contact', title: 'Contact Our Team', subtitle: null, body: null, data: { phone: null, email: null, whatsapp: null } },
];

export interface SeedServiceCategory {
  slug: string;
  title: string;
  intro: string;
  /** Icon name from @nurserylink/ui (expert service icons) */
  icon: string;
  services: string[];
}

export const SERVICE_CATEGORIES: SeedServiceCategory[] = [
  {
    slug: 'forestry-plantations-agroforestry',
    title: 'Forestry, Plantations and Agroforestry',
    intro: 'Professional support in tree growing, plantation establishment and sustainable land management, including:',
    icon: 'trees',
    services: [
      'Tree nursery establishment and management',
      'Plantation planning and establishment',
      'Woodlot design and management',
      'Agroforestry system design',
      'Tree-crop integration and spacing plans',
      'Pruning, thinning and plantation management',
      'Forest inventory and tree growth assessments',
      'Biomass and carbon-stock estimation',
    ],
  },
  {
    slug: 'agriculture-farm-advisory-extension',
    title: 'Agriculture, Farm Advisory and Extension',
    intro: 'Technical support for sustainable agricultural production and farm management, including:',
    icon: 'sprout',
    services: [
      'Farm planning and layout design',
      'Climate-smart agriculture',
      'Soil and water conservation',
      'Water harvesting and farm drainage planning',
      'Sustainable land management',
      'Agroforestry advisory',
      'Farmer training and extension support',
    ],
  },
  {
    slug: 'gis-remote-sensing-mapping-uav',
    title: 'GIS, Remote Sensing, Mapping and UAV',
    intro: 'Geospatial technologies for land management, forestry planning and environmental monitoring, including:',
    icon: 'map',
    services: [
      'Farm and land boundary mapping',
      'GIS database development and management',
      'Satellite-based land-cover and vegetation monitoring',
      'Remote sensing and spatial analysis',
      'Digital field data collection',
      'Drone-based mapping and vegetation assessment',
      'Geospatial dashboards and mapping reports',
    ],
  },
  {
    slug: 'environment-biodiversity-restoration',
    title: 'Environment, Biodiversity and Landscape Restoration',
    intro: 'Technical services supporting ecosystem conservation, restoration and environmental management, including:',
    icon: 'leaf',
    services: [
      'Restoration planning and site assessments',
      'Native tree species identification and selection',
      'Biodiversity and ecological baseline surveys',
      'Catchment and watershed assessments',
      'Environmental screening and impact assessment support',
      'Soil and land degradation assessments',
      'Monitoring of restoration activities',
      'Technical support for nature-based and carbon projects',
    ],
  },
  {
    slug: 'research-monitoring-evaluation',
    title: 'Research, Monitoring, Evaluation and Technical Reporting',
    intro: 'Data-driven technical support for projects, organizations and institutions, including:',
    icon: 'chart',
    services: [
      'Baseline surveys and field assessments',
      'Household and community data collection',
      'Tree survival and growth monitoring',
      'Field data management and quality control',
      'Biomass estimation and environmental data analysis',
      'Monitoring and evaluation frameworks',
      'Technical reports and progress dashboards',
      'Research support and documentation',
    ],
  },
  {
    slug: 'consultancy-project-design',
    title: 'Consultancy, Project Design and Implementation',
    intro: 'Support in developing and implementing forestry, agricultural and environmental initiatives, including:',
    icon: 'clipboard',
    services: [
      'Project concept note development',
      'Technical proposal preparation',
      'Forestry and restoration project planning',
      'Agroforestry and plantation investment planning',
      'Community mobilization and stakeholder engagement',
      'Farmer capacity building and training',
      'Project implementation support',
      'Technical supervision and monitoring',
    ],
  },
];
