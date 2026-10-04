import { PrismaClient, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const PASSWORD = "password123";

async function user(email: string, name: string, role: Role, companyId?: string) {
  return db.user.upsert({
    where: { email },
    update: {},
    create: { email, name, role, companyId, passwordHash: await bcrypt.hash(PASSWORD, 10) },
  });
}

const inMonths = (m: number) => {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + m, 1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

async function main() {
  await user("admin@example.com", "Platform Admin", "ADMIN");
  await user("support@example.com", "Sam Support", "SUPPORT");
  await user("customer@example.com", "Carla Customer", "CUSTOMER");

  const company = await db.company.upsert({
    where: { slug: "sunway-tours" },
    update: {},
    create: {
      name: "Sunway Tours",
      slug: "sunway-tours",
      description: "Small-group cultural and beach holidays around the Mediterranean and North Africa since 2009.",
      contactEmail: "hello@sunway.example",
      contactPhone: "+20 100 000 0000",
      city: "Cairo",
      country: "Egypt",
      commissionRate: 0.1,
    },
  });
  await user("owner@example.com", "Omar Owner", "COMPANY_OWNER", company.id);
  await user("employee@example.com", "Eve Employee", "COMPANY_EMPLOYEE", company.id);

  if ((await db.travelPackage.count({ where: { companyId: company.id } })) === 0) {
    await db.travelPackage.createMany({
      data: [
        {
          companyId: company.id,
          title: "Classic Egypt: Cairo, Luxor & Nile Cruise",
          destination: "Cairo & Luxor",
          country: "Egypt",
          description:
            "Day 1-2 Cairo: pyramids of Giza, Egyptian Museum, Khan el-Khalili. Day 3 fly to Luxor. Day 3-6 Nile cruise Luxor to Aswan with Karnak, Valley of the Kings, Edfu and Kom Ombo. Day 7 Abu Simbel option. Day 8 fly back to Cairo.",
          durationDays: 8,
          pricePerPerson: 1290,
          costPerPerson: 870,
          inclusions: ["4-star hotels in Cairo", "4 nights Nile cruise, full board", "Domestic flights", "Egyptologist guide", "Airport transfers"],
          exclusions: ["International flights", "Visa", "Tips", "Abu Simbel excursion"],
          availableFrom: inMonths(1),
          availableTo: inMonths(10),
          seatsTotal: 40,
          maxGroupSize: 8,
          status: "ACTIVE",
        },
        {
          companyId: company.id,
          title: "Red Sea Escape: Hurghada All-Inclusive",
          destination: "Hurghada",
          country: "Egypt",
          description: "Five relaxed nights at a beachfront resort with a snorkeling day trip to Giftun Island and an optional desert quad safari.",
          durationDays: 6,
          pricePerPerson: 640,
          costPerPerson: 410,
          inclusions: ["5 nights all-inclusive resort", "Giftun Island snorkeling trip", "Airport transfers"],
          exclusions: ["Flights", "Diving courses", "Quad safari"],
          availableFrom: inMonths(0),
          availableTo: inMonths(12),
          seatsTotal: 60,
          maxGroupSize: 6,
          status: "ACTIVE",
        },
        {
          companyId: company.id,
          title: "Istanbul & Cappadocia Highlights",
          destination: "Istanbul & Cappadocia",
          country: "Turkey",
          description:
            "Three days in Istanbul (Hagia Sophia, Blue Mosque, Grand Bazaar, Bosphorus cruise) then fly to Cappadocia for cave hotels, the Göreme open-air museum and a sunrise hot-air balloon flight.",
          durationDays: 7,
          pricePerPerson: 1150,
          costPerPerson: 790,
          inclusions: ["Boutique hotels with breakfast", "Domestic flight", "Hot-air balloon flight", "Guided tours"],
          exclusions: ["International flights", "Lunches and dinners", "Tips"],
          availableFrom: inMonths(2),
          availableTo: inMonths(9),
          seatsTotal: 24,
          maxGroupSize: 6,
          status: "ACTIVE",
        },
      ],
    });
  }

  console.log(`Seeded. All demo accounts use the password "${PASSWORD}":`);
  console.log("  admin@example.com, support@example.com, owner@example.com, employee@example.com, customer@example.com");
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
