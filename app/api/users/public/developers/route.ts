// FILE: app/api/users/public/developers/route.ts
// PURPOSE: Public API for published developers with automatic initial database seeding

import { apiHandler, json, serialize } from "@/lib/server/api";

const SEED_DEVELOPERS = [
  { name: "Alex Rivera", headline: "Principal Cloud Architect", skills: ["AWS", "Kubernetes", "Go", "PostgreSQL"], experienceYears: 10, bio: "Designs ultra-reliable, high-throughput cloud infrastructure and distributed microservices.", email: "alex.rivera@websmithdigital.com" },
  { name: "Sophia Chen", headline: "Lead Full-Stack Engineer", skills: ["Next.js", "React 19", "TypeScript", "Node.js"], experienceYears: 8, bio: "Specializes in modern React architecture, complex interactive dashboards, and design systems.", email: "sophia.chen@websmithdigital.com" },
  { name: "Marcus Vance", headline: "Enterprise Systems Architect", skills: ["Java", "Spring Boot", "PostgreSQL", "Docker"], experienceYears: 12, bio: "Architects mission-critical ERP systems, high-compliance APIs, and enterprise data sync pipelines.", email: "marcus.vance@websmithdigital.com" },
  { name: "Elena Rostova", headline: "Senior Mobile & Web Engineer", skills: ["React Native", "Flutter", "iOS", "TypeScript"], experienceYears: 7, bio: "Crafts silky-smooth cross-platform mobile experiences with strict offline-first resilience.", email: "elena.rostova@websmithdigital.com" },
  { name: "David Kim", headline: "Senior Security & Backend Engineer", skills: ["Python", "FastAPI", "Redis", "Cryptography"], experienceYears: 9, bio: "Expert in AES-256 encryption, HMAC API security gates, and ultra-low-latency backend services.", email: "david.kim@websmithdigital.com" },
  { name: "Priya Sharma", headline: "Lead UI/UX Engineer", skills: ["Tailwind CSS", "Next.js", "Figma", "Design Systems"], experienceYears: 6, bio: "Obsessed with micro-interactions, responsive typography, and enterprise-grade design systems.", email: "priya.sharma@websmithdigital.com" },
];

export const GET = apiHandler(async ({ db }) => {
  try {
    const collection = db.collection("users");
    let developers = await collection
      .find({ role: "developer", published: true })
      .sort({ name: 1 })
      .toArray();

    if (developers.length === 0) {
      for (const item of SEED_DEVELOPERS) {
        await collection.insertOne({
          ...item,
          role: "developer",
          status: "active",
          published: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      developers = await collection
        .find({ role: "developer", published: true })
        .sort({ name: 1 })
        .toArray();
    }

    const data = developers.map((u) => ({
      _id: u._id.toString(),
      name: u.name,
      email: u.email,
      phone: u.phone ?? "",
      company: u.company ?? "Websmith Digital",
      headline: u.headline ?? "",
      bio: u.bio ?? "",
      skills: u.skills ?? [],
      experienceYears: u.experienceYears ?? 0,
      status: u.status ?? "active",
      joinedAt: u.joinedAt ?? null,
      avatar: u.avatar ?? "",
      published: u.published ?? true,
    }));
    return json({ data });
  } catch (error) {
    console.warn("Public developers read warning (returning empty list):", error instanceof Error ? error.message : error);
    return json({ data: [] });
  }
});
