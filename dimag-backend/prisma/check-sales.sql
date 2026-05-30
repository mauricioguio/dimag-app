SELECT id, "createdAt", "customerName", total FROM "Sale" WHERE DATE("createdAt" AT TIME ZONE 'America/Bogota') <> '2026-05-21' ORDER BY "createdAt" DESC;
