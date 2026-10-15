import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";

async function main() {
  const password = process.env.ACCESS_PASSWORD;
  if (!password) {
    console.error("ACCESS_PASSWORD not found in environment");
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: { passwordHash },
    create: {
      username: "admin",
      passwordHash,
      name: "管理员",
      role: "ADMIN",
      avatar: "notion_muse_coder",
    },
  });

  console.log(`Admin user ready: ${admin.username} (${admin.name})`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
