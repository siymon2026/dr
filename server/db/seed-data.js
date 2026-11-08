/** Reference data for a Moroccan marketplace (real cities, taxonomy, plans, content). */

export const CITIES = [
  { slug: 'casablanca', ar: 'الدار البيضاء', fr: 'Casablanca', en: 'Casablanca', region: 'Casablanca-Settat', lat: 33.5731, lng: -7.5898 },
  { slug: 'rabat', ar: 'الرباط', fr: 'Rabat', en: 'Rabat', region: 'Rabat-Salé-Kénitra', lat: 34.0209, lng: -6.8416 },
  { slug: 'marrakech', ar: 'مراكش', fr: 'Marrakech', en: 'Marrakech', region: 'Marrakech-Safi', lat: 31.6295, lng: -7.9811 },
  { slug: 'fes', ar: 'فاس', fr: 'Fès', en: 'Fez', region: 'Fès-Meknès', lat: 34.0181, lng: -5.0078 },
  { slug: 'tanger', ar: 'طنجة', fr: 'Tanger', en: 'Tangier', region: 'Tanger-Tétouan-Al Hoceïma', lat: 35.7595, lng: -5.834 },
  { slug: 'agadir', ar: 'أكادير', fr: 'Agadir', en: 'Agadir', region: 'Souss-Massa', lat: 30.4278, lng: -9.5981 },
  { slug: 'meknes', ar: 'مكناس', fr: 'Meknès', en: 'Meknes', region: 'Fès-Meknès', lat: 33.8935, lng: -5.5473 },
  { slug: 'oujda', ar: 'وجدة', fr: 'Oujda', en: 'Oujda', region: 'Oriental', lat: 34.6867, lng: -1.9114 },
  { slug: 'kenitra', ar: 'القنيطرة', fr: 'Kénitra', en: 'Kenitra', region: 'Rabat-Salé-Kénitra', lat: 34.261, lng: -6.5802 },
  { slug: 'tetouan', ar: 'تطوان', fr: 'Tétouan', en: 'Tetouan', region: 'Tanger-Tétouan-Al Hoceïma', lat: 35.5785, lng: -5.3684 },
  { slug: 'safi', ar: 'آسفي', fr: 'Safi', en: 'Safi', region: 'Marrakech-Safi', lat: 32.2994, lng: -9.2372 },
  { slug: 'el-jadida', ar: 'الجديدة', fr: 'El Jadida', en: 'El Jadida', region: 'Casablanca-Settat', lat: 33.2316, lng: -8.5007 },
  { slug: 'beni-mellal', ar: 'بني ملال', fr: 'Béni Mellal', en: 'Beni Mellal', region: 'Béni Mellal-Khénifra', lat: 32.3373, lng: -6.3498 },
  { slug: 'nador', ar: 'الناظور', fr: 'Nador', en: 'Nador', region: 'Oriental', lat: 35.1681, lng: -2.9335 },
  { slug: 'khouribga', ar: 'خريبكة', fr: 'Khouribga', en: 'Khouribga', region: 'Béni Mellal-Khénifra', lat: 32.8811, lng: -6.9063 },
  { slug: 'settat', ar: 'سطات', fr: 'Settat', en: 'Settat', region: 'Casablanca-Settat', lat: 33.0011, lng: -7.6166 },
  { slug: 'sale', ar: 'سلا', fr: 'Salé', en: 'Sale', region: 'Rabat-Salé-Kénitra', lat: 34.0531, lng: -6.7985 },
  { slug: 'mohammedia', ar: 'المحمدية', fr: 'Mohammedia', en: 'Mohammedia', region: 'Casablanca-Settat', lat: 33.6861, lng: -7.383 },
  { slug: 'laayoune', ar: 'العيون', fr: 'Laâyoune', en: 'Laayoune', region: 'Laâyoune-Sakia El Hamra', lat: 27.1253, lng: -13.1625 },
  { slug: 'dakhla', ar: 'الداخلة', fr: 'Dakhla', en: 'Dakhla', region: 'Dakhla-Oued Ed-Dahab', lat: 23.6848, lng: -15.958 },
  { slug: 'essaouira', ar: 'الصويرة', fr: 'Essaouira', en: 'Essaouira', region: 'Marrakech-Safi', lat: 31.5085, lng: -9.7595 },
  { slug: 'taza', ar: 'تازة', fr: 'Taza', en: 'Taza', region: 'Fès-Meknès', lat: 34.21, lng: -4.01 },
  { slug: 'berrechid', ar: 'برشيد', fr: 'Berrechid', en: 'Berrechid', region: 'Casablanca-Settat', lat: 33.2655, lng: -7.5872 },
  { slug: 'khemisset', ar: 'الخميسات', fr: 'Khémisset', en: 'Khemisset', region: 'Rabat-Salé-Kénitra', lat: 33.8242, lng: -6.0658 },
  { slug: 'ouzoud', ar: 'أوزود', fr: 'Ouzoud', en: 'Ouzoud', region: 'Béni Mellal-Khénifra', lat: 32.0119, lng: -6.7176 },
  { slug: 'ifrane', ar: 'إفران', fr: 'Ifrane', en: 'Ifrane', region: 'Fès-Meknès', lat: 33.5227, lng: -5.1105 },
  { slug: 'chefchaouen', ar: 'شفشاون', fr: 'Chefchaouen', en: 'Chefchaouen', region: 'Tanger-Tétouan-Al Hoceïma', lat: 35.168, lng: -5.2636 },
  { slug: 'taroudant', ar: 'تارودانت', fr: 'Taroudant', en: 'Taroudant', region: 'Souss-Massa', lat: 30.4703, lng: -8.8769 },
  { slug: 'ouarzazate', ar: 'ورزازات', fr: 'Ouarzazate', en: 'Ouarzazate', region: 'Drâa-Tafilalet', lat: 30.9335, lng: -6.8933 },
  { slug: 'errachidia', ar: 'الرشيدية', fr: 'Errachidia', en: 'Errachidia', region: 'Drâa-Tafilalet', lat: 31.9314, lng: -4.4245 },
  { slug: 'tinghir', ar: 'تنغير', fr: 'Tinghir', en: 'Tinghir', region: 'Drâa-Tafilalet', lat: 31.5147, lng: -5.5326 },
];

export const AREAS = {
  casablanca: ['المعاريف', 'سيدي معروف', 'عين الذياب', 'الحي الحسني', 'أنفا', 'بوركون', 'سيدي البرنوصي', 'دار بوعزة', 'المدينة القديمة', 'الحي المحمدي'],
  rabat: ['أكدال', 'حسان', 'الرباط المدينة', 'السويسي', 'يعقوب المنصور', 'الحي الرياض', 'التقدم', 'العرفان'],
  marrakech: ['المدينة', 'جليز', 'النخيل', 'حي الحسين', 'المسيرة', 'سيدي مومندي', 'تاركة', 'المحاميد'],
  fes: ['المدينة القديمة', 'ظهار', 'سايس', 'أكادير', 'النرجس', 'المرينيين', 'ابن خلدون'],
  tanger: ['المدينة', 'مالاباطا', 'بني مكادة', 'الشرف', 'الزياتن', 'باريو', 'طنجة البالية'],
  agadir: ['حي الهدى', 'تالبرجت', 'أنزا', 'فونتي', 'السلام', 'حي دراركة'],
  meknes: ['حمرية', 'المدينة القديمة', 'مرجان', 'تولال', 'بلدي', 'بيت الحمد'],
  oujda: ['المدينة القديمة', 'الحي القاسمي', 'الناظور', 'القدس', 'سيدي يحيى'],
  kenitra: ['المدينة', 'أولاد أوجيه', 'ميموزة', 'البير', 'السلام'],
  tetouan: ['المدينة القديمة', 'طريق تطوان', 'المرتيل', 'باريو ملاحة'],
  safi: ['المدينة', 'البيضاء', 'سيدي بوزيد', 'كوردي'],
  'el-jadida': ['المدينة', 'سيدي بوزيد', 'حي السلام', 'أزمور'],
  'beni-mellal': ['المدينة', 'الحي الإداري', 'المنطقة الصناعية', 'أولاد عياد'],
  nador: ['المدينة', 'الحي الجديد', 'سلوان', 'بني أنصار'],
  sale: ['المدينة', 'بطانة', 'تابريكت', 'حي السلام', 'سيدي موسى'],
  'laayoune': ['المدينة', 'الحي الحسني', 'الجرف', 'الفنيدق'],
};

export const CATEGORIES = [
  { slug: 'vehicles', ar: 'السيارات والدراجات النارية', fr: 'Véhicules & motos', en: 'Cars & Motorcycles', icon: 'car', color: '#2563eb', children: [
    { slug: 'cars', ar: 'سيارات', fr: 'Voitures', en: 'Cars' },
    { slug: 'motorcycles', ar: 'دراجات نارية', fr: 'Motos', en: 'Motorcycles' },
    { slug: 'trucks', ar: 'شاحنات وحافلات', fr: 'Camions & bus', en: 'Trucks & Buses' },
    { slug: 'vehicle-parts', ar: 'قطع غيار', fr: 'Pièces détachées', en: 'Spare Parts' },
    { slug: 'bikes', ar: 'دراجات هوائية', fr: 'Vélos', en: 'Bicycles' },
  ]},
  { slug: 'real-estate', ar: 'العقارات والشقق والمنازل', fr: 'Immobilier', en: 'Real Estate', icon: 'home', color: '#059669', children: [
    { slug: 'apartments-sale', ar: 'شقق للبيع', fr: 'Appartements à vendre', en: 'Apartments for Sale' },
    { slug: 'apartments-rent', ar: 'شقق للكراء', fr: 'Appartements à louer', en: 'Apartments for Rent' },
    { slug: 'houses', ar: 'منازل وفيلات', fr: 'Maisons & villas', en: 'Houses & Villas' },
    { slug: 'land', ar: 'أراضي', fr: 'Terrains', en: 'Land' },
    { slug: 'commercial', ar: 'محلات ومكاتب', fr: 'Locaux commerciaux', en: 'Commercial Spaces' },
  ]},
  { slug: 'phones', ar: 'الهواتف والأجهزة الإلكترونية', fr: 'Téléphones & électronique', en: 'Phones & Electronics', icon: 'phone', color: '#7c3aed', children: [
    { slug: 'smartphones', ar: 'هواتف ذكية', fr: 'Smartphones', en: 'Smartphones' },
    { slug: 'tablets', ar: 'أجهزة لوحية', fr: 'Tablettes', en: 'Tablets' },
    { slug: 'tvs', ar: 'تلفزيونات', fr: 'Télévisions', en: 'TVs' },
    { slug: 'audio', ar: 'صوتيات وسماعات', fr: 'Audio & casques', en: 'Audio & Headphones' },
    { slug: 'consoles', ar: 'ألعاب فيديو', fr: 'Consoles de jeux', en: 'Gaming Consoles' },
  ]},
  { slug: 'computers', ar: 'الحواسيب والإكسسوارات', fr: 'Ordinateurs & accessoires', en: 'Computers & Accessories', icon: 'laptop', color: '#0891b2', children: [
    { slug: 'laptops', ar: 'حواسيب محمولة', fr: 'Ordinateurs portables', en: 'Laptops' },
    { slug: 'desktops', ar: 'حواسيب مكتبية', fr: 'Ordinateurs de bureau', en: 'Desktops' },
    { slug: 'printers', ar: 'طابعات', fr: 'Imprimantes', en: 'Printers' },
    { slug: 'network', ar: 'شبكات', fr: 'Réseaux', en: 'Networking' },
    { slug: 'pc-accessories', ar: 'إكسسوارات', fr: 'Accessoires', en: 'Accessories' },
  ]},
  { slug: 'fashion', ar: 'الملابس والأحذية', fr: 'Mode & chaussures', en: 'Clothing & Shoes', icon: 'shirt', color: '#db2777', children: [
    { slug: 'men-clothing', ar: 'ملابس رجالية', fr: 'Vêtements homme', en: 'Men Clothing' },
    { slug: 'women-clothing', ar: 'ملابس نسائية', fr: 'Vêtements femme', en: 'Women Clothing' },
    { slug: 'kids-clothing', ar: 'ملابس أطفال', fr: 'Vêtements enfant', en: 'Kids Clothing' },
    { slug: 'shoes', ar: 'أحذية', fr: 'Chaussures', en: 'Shoes' },
    { slug: 'bags', ar: 'حقائب وإكسسوارات', fr: 'Sacs & accessoires', en: 'Bags & Accessories' },
  ]},
  { slug: 'home-furniture', ar: 'الأثاث والديكور المنزلي', fr: 'Meubles & déco', en: 'Furniture & Decor', icon: 'sofa', color: '#b45309', children: [
    { slug: 'living-room', ar: 'أثاث الصالون', fr: 'Salon', en: 'Living Room' },
    { slug: 'bedroom', ar: 'غرف النوم', fr: 'Chambres', en: 'Bedroom' },
    { slug: 'kitchen-furniture', ar: 'مطابخ', fr: 'Cuisines', en: 'Kitchens' },
    { slug: 'decor', ar: 'ديكور', fr: 'Décoration', en: 'Decor' },
  ]},
  { slug: 'appliances', ar: 'الأجهزة المنزلية', fr: 'Électroménager', en: 'Home Appliances', icon: 'plug', color: '#0d9488', children: [
    { slug: 'fridges', ar: 'ثلاجات', fr: 'Réfrigérateurs', en: 'Refrigerators' },
    { slug: 'washing', ar: 'غسالات', fr: 'Lave-linge', en: 'Washing Machines' },
    { slug: 'cooking', ar: 'أجهزة الطبخ', fr: 'Cuisinières', en: 'Cooking' },
    { slug: 'small-appliances', ar: 'أجهزة صغيرة', fr: 'Petits appareils', en: 'Small Appliances' },
  ]},
  { slug: 'sports', ar: 'الرياضة والترفيه', fr: 'Sport & loisirs', en: 'Sports & Leisure', icon: 'dumbbell', color: '#ea580c', children: [
    { slug: 'fitness', ar: 'لياقة بدنية', fr: 'Fitness', en: 'Fitness' },
    { slug: 'football', ar: 'كرة القدم', fr: 'Football', en: 'Football' },
    { slug: 'camping', ar: 'تخييم ورحلات', fr: 'Camping & randonnée', en: 'Camping & Hiking' },
    { slug: 'water-sports', ar: 'رياضات مائية', fr: 'Sports nautiques', en: 'Water Sports' },
  ]},
  { slug: 'animals', ar: 'الحيوانات ومستلزماتها', fr: 'Animaux & accessoires', en: 'Animals & Supplies', icon: 'paw', color: '#65a30d', children: [
    { slug: 'pets', ar: 'حيوانات أليفة', fr: 'Animaux de compagnie', en: 'Pets' },
    { slug: 'pet-supplies', ar: 'مستلزمات الحيوانات', fr: 'Accessoires animaux', en: 'Pet Supplies' },
    { slug: 'livestock', ar: 'ماشية ودواجن', fr: 'Bétail & volaille', en: 'Livestock' },
  ]},
  { slug: 'tools', ar: 'الأدوات والمعدات المهنية', fr: 'Outils & équipements', en: 'Tools & Equipment', icon: 'wrench', color: '#475569', children: [
    { slug: 'power-tools', ar: 'أدوات كهربائية', fr: 'Outils électriques', en: 'Power Tools' },
    { slug: 'hand-tools', ar: 'أدوات يدوية', fr: 'Outils manuels', en: 'Hand Tools' },
    { slug: 'industrial', ar: 'معدات صناعية', fr: 'Équipement industriel', en: 'Industrial Equipment' },
  ]},
  { slug: 'building-materials', ar: 'مواد البناء', fr: 'Matériaux de construction', en: 'Building Materials', icon: 'bricks', color: '#a16207', children: [
    { slug: 'cement', ar: 'إسمنت وحديد', fr: 'Ciment & fer', en: 'Cement & Steel' },
    { slug: 'tiles', ar: 'زليج وبلاط', fr: 'Carrelage', en: 'Tiles' },
    { slug: 'wood', ar: 'خشب', fr: 'Bois', en: 'Wood' },
    { slug: 'sanitary', ar: 'أدوات صحية', fr: 'Sanitaire', en: 'Sanitary Ware' },
  ]},
  { slug: 'books', ar: 'الكتب والتعليم', fr: 'Livres & éducation', en: 'Books & Education', icon: 'book', color: '#1d4ed8', children: [
    { slug: 'books-sale', ar: 'كتب', fr: 'Livres', en: 'Books' },
    { slug: 'school-supplies', ar: 'أدوات مدرسية', fr: 'Fournitures scolaires', en: 'School Supplies' },
    { slug: 'courses', ar: 'دورات تكوينية', fr: 'Formations', en: 'Training' },
  ]},
  { slug: 'kids-toys', ar: 'ألعاب الأطفال', fr: 'Jouets', en: 'Kids Toys', icon: 'toy', color: '#f59e0b', children: [
    { slug: 'toys', ar: 'ألعاب', fr: 'Jouets', en: 'Toys' },
    { slug: 'outdoor-toys', ar: 'ألعاب خارجية', fr: 'Jeux d’extérieur', en: 'Outdoor Toys' },
  ]},
  { slug: 'baby', ar: 'مستلزمات الأطفال', fr: 'Bébé & puériculture', en: 'Baby Essentials', icon: 'baby', color: '#f472b6', children: [
    { slug: 'strollers', ar: 'عربات أطفال', fr: 'Poussettes', en: 'Strollers' },
    { slug: 'baby-clothes', ar: 'ملابس أطفال', fr: 'Vêtements bébé', en: 'Baby Clothes' },
    { slug: 'baby-care', ar: 'العناية بالطفل', fr: 'Soins bébé', en: 'Baby Care' },
  ]},
  { slug: 'beauty', ar: 'منتجات التجميل والعناية', fr: 'Beauté & soins', en: 'Beauty & Care', icon: 'sparkles', color: '#be185d', children: [
    { slug: 'makeup', ar: 'مكياج', fr: 'Maquillage', en: 'Makeup' },
    { slug: 'skincare', ar: 'العناية بالبشرة', fr: 'Soins de la peau', en: 'Skincare' },
    { slug: 'perfumes', ar: 'عطور', fr: 'Parfums', en: 'Perfumes' },
  ]},
  { slug: 'services', ar: 'الخدمات', fr: 'Services', en: 'Services', icon: 'tools', color: '#0f766e', children: [
    { slug: 'repair-services', ar: 'إصلاح وصيانة', fr: 'Réparation', en: 'Repair' },
    { slug: 'home-services', ar: 'خدمات منزلية', fr: 'Services à domicile', en: 'Home Services' },
    { slug: 'transport', ar: 'نقل وشحن', fr: 'Transport', en: 'Transport' },
    { slug: 'tutoring', ar: 'دروس خصوصية', fr: 'Cours particuliers', en: 'Tutoring' },
  ]},
  { slug: 'jobs', ar: 'فرص العمل', fr: 'Emploi', en: 'Jobs', icon: 'briefcase', color: '#334155', children: [
    { slug: 'full-time', ar: 'عمل بدوام كامل', fr: 'Temps plein', en: 'Full-time' },
    { slug: 'part-time', ar: 'عمل بدوام جزئي', fr: 'Temps partiel', en: 'Part-time' },
    { slug: 'freelance', ar: 'عمل حر', fr: 'Freelance', en: 'Freelance' },
  ]},
  { slug: 'misc', ar: 'منتجات متنوعة', fr: 'Divers', en: 'Miscellaneous', icon: 'box', color: '#6b7280', children: [
    { slug: 'collectibles', ar: 'تحف ومقتنيات', fr: 'Collection', en: 'Collectibles' },
    { slug: 'other', ar: 'أخرى', fr: 'Autres', en: 'Other' },
  ]},
];

export const PLANS = [
  {
    code: 'free',
    ar: 'مجاني', fr: 'Gratuit', en: 'Free',
    desc_ar: 'ابدأ البيع مجاناً مع 5 إعلانات نشطة.',
    desc_fr: 'Commencez gratuitement avec 5 annonces actives.',
    desc_en: 'Start selling for free with 5 active listings.',
    price: 0, days: 30, quota: 5, featured: 0, store: 0,
    features: ['5 إعلانات نشطة', 'محادثات غير محدودة', 'حتى 15 صورة لكل إعلان'],
  },
  {
    code: 'pro',
    ar: 'محترف', fr: 'Pro', en: 'Pro',
    desc_ar: 'للبائعين النشطين: إعلانات أكثر وتمييز شهري.',
    desc_fr: 'Pour vendeurs actifs : plus d’annonces et mises en avant.',
    desc_en: 'For active sellers: more listings and monthly boosts.',
    price: 9900, days: 30, quota: 30, featured: 3, store: 0,
    features: ['30 إعلاناً نشطاً', '3 إعلانات مميزة شهرياً', 'شارة بائع محترف', 'دعم ذو أولوية'],
  },
  {
    code: 'business',
    ar: 'تجاري', fr: 'Business', en: 'Business',
    desc_ar: 'متجر احترافي كامل مع إحصائيات ودعم مخصص.',
    desc_fr: 'Boutique complète avec statistiques et support dédié.',
    desc_en: 'Full storefront with analytics and dedicated support.',
    price: 24900, days: 30, quota: 150, featured: 10, store: 1,
    features: ['150 إعلاناً نشطاً', '10 إعلانات مميزة شهرياً', 'متجر احترافي موثق', 'إحصائيات مفصلة', 'أولوية في المراجعة'],
  },
  {
    code: 'business-year',
    ar: 'تجاري سنوي', fr: 'Business annuel', en: 'Business Yearly',
    desc_ar: 'وفّر شهرين مع الاشتراك السنوي التجاري.',
    desc_fr: 'Économisez 2 mois avec l’abonnement annuel Business.',
    desc_en: 'Save 2 months with the yearly Business plan.',
    price: 249000, days: 365, quota: 150, featured: 10, store: 1,
    features: ['كل ميزات الباقة التجارية', 'شهران مجاناً', 'دعم هاتفي مباشر'],
  },
];

export const BOOSTS = [
  { code: 'feature-7', type: 'feature', ar: 'إعلان مميز — 7 أيام', fr: 'Annonce en vedette — 7 jours', en: 'Featured listing — 7 days', price: 4900, days: 7 },
  { code: 'feature-30', type: 'feature', ar: 'إعلان مميز — 30 يوماً', fr: 'Annonce en vedette — 30 jours', en: 'Featured listing — 30 days', price: 14900, days: 30 },
  { code: 'pin-7', type: 'pin', ar: 'تثبيت في الأعلى — 7 أيام', fr: 'Épingler en haut — 7 jours', en: 'Pin to top — 7 days', price: 7900, days: 7 },
  { code: 'bump-1', type: 'bump', ar: 'إعادة نشر فورية', fr: 'Remontée immédiate', en: 'Instant bump', price: 2900, days: 1 },
];

export const PAGES = [
  {
    slug: 'about',
    title_ar: 'من نحن', title_fr: 'À propos', title_en: 'About us',
    body_ar: 'بيع وشري أونلاين منصة مغربية تجمع البائعين والمشترين في جميع أنحاء المملكة. هدفنا تسهيل البيع والشراء بين الأفراد والتجار في بيئة آمنة وشفافة وموثوقة، مع دعم كامل للغة العربية والفرنسية.',
    body_fr: 'Bii3 & Chri Online est une plateforme marocaine qui rassemble vendeurs et acheteurs partout au Royaume. Notre mission : faciliter la vente entre particuliers et professionnels dans un environnement sûr et transparent.',
    body_en: 'Bii3 & Chri Online is a Moroccan marketplace connecting buyers and sellers across the Kingdom in a safe, transparent environment.',
  },
  {
    slug: 'privacy',
    title_ar: 'سياسة الخصوصية', title_fr: 'Politique de confidentialité', title_en: 'Privacy policy',
    body_ar: 'نحترم خصوصيتك. نجمع فقط البيانات الضرورية لتشغيل المنصة: الاسم، وسيلة التواصل، المدينة، والإعلانات. لا نبيع بياناتك لأي طرف ثالث. يمكنك تصدير بياناتك أو طلب حذف حسابك في أي وقت من صفحة الحساب.\n\nنحتفظ برقم هاتفك مخفياً عن العامة حسب إعداداتك، ونستخدمه فقط لتواصل المشترين معك بموافقتك.',
    body_fr: 'Nous respectons votre vie privée. Nous ne collectons que les données nécessaires au fonctionnement de la plateforme et ne les vendons jamais. Vous pouvez exporter vos données ou supprimer votre compte à tout moment.',
    body_en: 'We respect your privacy. We only collect data necessary to run the marketplace, never sell it, and let you export or delete your account at any time.',
  },
  {
    slug: 'terms',
    title_ar: 'شروط الاستخدام', title_fr: "Conditions d'utilisation", title_en: 'Terms of use',
    body_ar: 'باستخدامك للمنصة فإنك توافق على:\n\n1. عدم نشر أي منتجات محظورة قانونياً أو مقلدة.\n2. تقديم معلومات صحيحة في الإعلانات.\n3. احترام المستخدمين الآخرين وعدم الإساءة أو التحايل.\n4. تحمل مسؤولية المعاملات التي تجريها خارج المنصة.\n5. إمكانية حذف أي إعلان مخالف دون إشعار مسبق.',
    body_fr: "En utilisant la plateforme, vous acceptez de ne publier aucun produit illégal ou contrefait, de fournir des informations exactes et de respecter les autres utilisateurs.",
    body_en: 'By using the platform you agree not to post illegal or counterfeit items, to provide accurate information, and to respect other users.',
  },
  {
    slug: 'prohibited',
    title_ar: 'المنتجات المحظورة', title_fr: 'Produits interdits', title_en: 'Prohibited items',
    body_ar: 'يُمنع منعاً باتاً نشر: الأسلحة والمتفجرات، المخدرات، الأدوية المزيفة، المنتجات المقلدة، الحيوانات المحمية، الوثائق الرسمية، المحتوى الجنسي، وأي منتج مخالف للقانون المغربي. سيتم حذف الإعلانات المخالفة وحظر صاحبها.',
    body_fr: 'Il est strictement interdit de publier : armes, explosifs, drogues, médicaments falsifiés, contrefaçons, espèces protégées, documents officiels et tout contenu illégal selon la loi marocaine.',
    body_en: 'Strictly prohibited: weapons, explosives, drugs, counterfeit medicine, counterfeit goods, protected species, official documents, and anything illegal under Moroccan law.',
  },
  {
    slug: 'help',
    title_ar: 'مركز المساعدة', title_fr: "Centre d'aide", title_en: 'Help center',
    body_ar: 'كيف أنشر إعلاناً؟\n1. أنشئ حساباً مجانياً.\n2. اضغط على «أضف إعلان».\n3. أضف الصور والوصف والسعر.\n4. انتظر المراجعة ثم يُنشر إعلانك.\n\nكيف أتواصل مع البائع؟\nمن صفحة الإعلان اضغط «إرسال رسالة» أو اتصل بالرقم إن كان ظاهراً.\n\nكيف أحافظ على أماني؟\n- لا تدفع مقدماً قبل رؤية المنتج.\n- قابل البائع في مكان عام.\n- أبلغ عن أي إعلان مشبوه.',
    body_fr: "Comment publier une annonce ? Créez un compte gratuit, cliquez sur « Déposer une annonce », ajoutez photos et description, puis attendez la validation.\n\nComment contacter un vendeur ? Utilisez la messagerie depuis l'annonce ou le numéro affiché.",
    body_en: 'How to post: create a free account, click "Post listing", add photos and description, then wait for review. Contact sellers via the message button or the public phone number.',
  },
];

export const FAQS = [
  { q_ar: 'هل النشر مجاني؟', a_ar: 'نعم، النشر مجاني. الباقات المدفوعة تتيح عدداً أكبر من الإعلانات والتمييز في النتائج.', q_fr: 'La publication est-elle gratuite ?', a_fr: 'Oui. Les offres payantes augmentent le quota et la visibilité.', q_en: 'Is posting free?', a_en: 'Yes. Paid plans increase your quota and visibility.' },
  { q_ar: 'كيف أتأكد من البائع؟', a_ar: 'راجع تقييماته وشارة «بائع موثق» الممنوحة إدارياً، وتواصل معه عبر المحادثات، ولا تدفع مقدماً.', q_fr: 'Comment vérifier un vendeur ?', a_fr: 'Consultez ses évaluations et le badge vérifié, discutez via la messagerie et ne payez jamais d’avance.', q_en: 'How do I verify a seller?', a_en: 'Check ratings and the verified badge, chat first, and never pay in advance.' },
  { q_ar: 'ما مدة صلاحية الإعلان؟', a_ar: '60 يوماً، ويمكنك تجديده أو إعادة نشره من صفحة «إعلاناتي».', q_fr: 'Durée de validité ?', a_fr: '60 jours, renouvelable depuis « Mes annonces ».', q_en: 'How long does a listing last?', a_en: '60 days; you can republish it from “My listings”.' },
  { q_ar: 'كيف أحذف حسابي؟', a_ar: 'من صفحة الحساب > الخصوصية > حذف الحساب. تُحذف بياناتك الشخصية نهائياً.', q_fr: 'Supprimer mon compte ?', a_fr: 'Depuis Compte > Confidentialité > Supprimer le compte.', q_en: 'Delete my account?', a_en: 'Account > Privacy > Delete account. Personal data is erased.' },
  { q_ar: 'هل يمكنني نشر إعلان في عدة مدن؟', a_ar: 'كل إعلان مرتبط بمدينة واحدة، لكن يمكنك نشر إعلانات مختلفة في مدن مختلفة.', q_fr: 'Plusieurs villes ?', a_fr: 'Chaque annonce est liée à une ville, mais vous pouvez publier dans plusieurs villes.', q_en: 'Multiple cities?', a_en: 'Each listing has one city, but you can post in several cities.' },
];

export const SETTINGS = {
  site_name_ar: 'بيع وشري أونلاين',
  site_name_fr: 'Bii3 & Chri Online',
  support_email: 'support@bii3chri.ma',
  support_phone: '+212 5 22 00 00 00',
  listing_ttl_days: '60',
  free_listing_quota: '5',
  moderation_auto_approve: false,
  maintenance_mode: false,
};
