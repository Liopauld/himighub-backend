require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Product = require('../models/Product');

const adminSeedEmail = process.env.ADMIN_SEED_EMAIL || 'admin@himighub.com';
const adminSeedPassword = process.env.ADMIN_SEED_PASSWORD || 'HimigHub@2026';
const adminSeedName = process.env.ADMIN_SEED_NAME || 'HIMIGHUB Super Admin';

const sampleProducts = [
  {
    name: 'Aurora Dreadnought Acoustic Guitar',
    description: 'Solid-top dreadnought acoustic guitar with warm, balanced tone for stage and studio.',
    price: 18990,
    originalPrice: 21990,
    discountPercent: 14,
    category: 'String',
    stock: 22,
    images: ['https://images.unsplash.com/photo-1510915361894-db8b60106cb1?auto=format&fit=crop&w=1200&q=80'],
    sizes: ['3/4 Size', 'Full Size', 'Left-Handed'],
    brand: 'Yamaha',
    isAvailable: true,
  },
  {
    name: 'Metroline Electric Guitar HSS',
    description: 'Modern electric guitar with HSS pickup layout and smooth maple neck.',
    price: 22990,
    originalPrice: 25990,
    discountPercent: 12,
    category: 'String',
    stock: 18,
    images: ['https://images.unsplash.com/photo-1525201548942-d8732f6617a0?auto=format&fit=crop&w=1200&q=80'],
    sizes: ['Standard Scale', 'Short Scale', 'Left-Handed'],
    brand: 'Fender',
    isAvailable: true,
  },
  {
    name: 'Concert Ukulele Mahogany',
    description: 'Lightweight concert ukulele with bright articulation and easy playability.',
    price: 6990,
    originalPrice: 8290,
    discountPercent: 16,
    category: 'String',
    stock: 30,
    images: ['https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=1200&q=80'],
    sizes: ['Concert', 'Tenor', 'Soprano'],
    brand: 'Kala',
    isAvailable: true,
  },
  {
    name: 'Studio 4-String Bass Guitar',
    description: 'Punchy 4-string bass ideal for rehearsal, recording, and live grooves.',
    price: 20990,
    originalPrice: 23990,
    discountPercent: 13,
    category: 'String',
    stock: 14,
    images: ['https://images.unsplash.com/photo-1507838153414-b4b713384a76?auto=format&fit=crop&w=1200&q=80'],
    sizes: ['Standard Scale', 'Short Scale'],
    brand: 'Ibanez',
    isAvailable: true,
  },
  {
    name: 'Symphony Violin Outfit',
    description: 'Complete violin outfit with bow and case for students and advancing players.',
    price: 12490,
    originalPrice: 14490,
    discountPercent: 14,
    category: 'String',
    stock: 20,
    images: ['https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=1200&q=80'],
    sizes: ['1/2 Size', '3/4 Size', 'Full Size'],
    brand: 'Stentor',
    isAvailable: true,
  },
  {
    name: 'Selmer Alto Saxophone Pack',
    description: 'Eb alto saxophone package with case, mouthpiece, and maintenance kit.',
    price: 48990,
    originalPrice: 53990,
    discountPercent: 9,
    category: 'Wind',
    stock: 10,
    images: ['https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?auto=format&fit=crop&w=1200&q=80'],
    sizes: ['Student', 'Intermediate', 'Professional'],
    brand: 'Selmer',
    isAvailable: true,
  },
  {
    name: 'Silver Concert Flute',
    description: 'Responsive concert flute with silver-plated body and offset G.',
    price: 17990,
    originalPrice: 20990,
    discountPercent: 14,
    category: 'Wind',
    stock: 16,
    images: ['https://images.unsplash.com/photo-1471478331149-c72f17e33c73?auto=format&fit=crop&w=1200&q=80'],
    sizes: ['Open Hole', 'Closed Hole'],
    brand: 'Yamaha',
    isAvailable: true,
  },
  {
    name: 'Boehm System Clarinet',
    description: 'Durable clarinet with smooth key action and consistent intonation.',
    price: 15990,
    originalPrice: 18990,
    discountPercent: 15,
    category: 'Wind',
    stock: 12,
    images: ['https://images.unsplash.com/photo-1453090927415-5f45085b65c0?auto=format&fit=crop&w=1200&q=80'],
    sizes: ['Student', 'Intermediate'],
    brand: 'Buffet Crampon',
    isAvailable: true,
  },
  {
    name: '5-Piece Maple Drum Kit',
    description: 'Full maple shell drum kit with cymbal-ready hardware and kick pedal.',
    price: 33990,
    originalPrice: 37990,
    discountPercent: 11,
    category: 'Percussion',
    stock: 9,
    images: ['https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?auto=format&fit=crop&w=1200&q=80'],
    sizes: ['Fusion', 'Standard', 'Rock'],
    brand: 'Pearl',
    isAvailable: true,
  },
  {
    name: 'Digital Stage Piano 88-Key',
    description: 'Weighted 88-key digital piano with layered grand presets and USB MIDI.',
    price: 42990,
    originalPrice: 47990,
    discountPercent: 10,
    category: 'Accessories',
    stock: 11,
    images: ['https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?auto=format&fit=crop&w=1200&q=80'],
    sizes: ['88-Key', '76-Key'],
    brand: 'Kawai',
    isAvailable: true,
  },
  {
    name: 'Pro Keyboard Sustain Pedal',
    description: 'Universal sustain pedal with polarity switch and anti-slip base.',
    price: 1490,
    originalPrice: 1990,
    discountPercent: 25,
    category: 'Accessories',
    stock: 55,
    images: ['https://images.unsplash.com/photo-1513883049090-d0b7439799bf?auto=format&fit=crop&w=1200&q=80'],
    sizes: ['Standard'],
    brand: 'Casio',
    isAvailable: true,
  },
  {
    name: 'Studio Condenser Microphone Kit',
    description: 'Large-diaphragm condenser microphone with shock mount and pop filter.',
    price: 8990,
    originalPrice: 10990,
    discountPercent: 18,
    category: 'Accessories',
    stock: 26,
    images: ['https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1200&q=80'],
    sizes: ['USB', 'XLR'],
    brand: 'Audio-Technica',
    isAvailable: true,
  },
];
const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing in environment variables');
  }

  await mongoose.connect(process.env.MONGODB_URI);
};

const ensureAdminUser = async () => {
  const passwordHash = await bcrypt.hash(adminSeedPassword, 10);

  const adminUser = await User.findOneAndUpdate(
    { email: adminSeedEmail.toLowerCase() },
    {
      $set: {
        name: adminSeedName,
        email: adminSeedEmail.toLowerCase(),
        password: passwordHash,
        role: 'admin',
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

  return adminUser;
};

const seedProducts = async (adminId, shouldReset) => {
  if (shouldReset) {
    await Product.deleteMany({});
  }

  const operations = sampleProducts.map((product) => ({
    updateOne: {
      filter: { name: product.name },
      update: {
        $set: {
          ...product,
          createdBy: adminId,
        },
      },
      upsert: true,
    },
  }));

  await Product.bulkWrite(operations, { ordered: true });
};

const main = async () => {
  const shouldReset = process.argv.includes('--reset');

  try {
    await connectDB();
    const adminUser = await ensureAdminUser();
    await seedProducts(adminUser._id, shouldReset);

    const totalProducts = await Product.countDocuments();

    console.log('Seed completed successfully.');
    console.log(`Admin email: ${adminSeedEmail}`);
    console.log(`Admin password: ${adminSeedPassword}`);
    console.log(`Total products in database: ${totalProducts}`);
    console.log(`Reset mode: ${shouldReset ? 'enabled' : 'disabled'}`);
  } catch (error) {
    console.error('Seed failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

main();