-- Preserve the initial migration and correct the approved optional equipment-to-lot link.
-- A position is present exactly when its lot is present.
ALTER TABLE "equipamentos"
  ALTER COLUMN "loteId" DROP NOT NULL,
  ALTER COLUMN "posicaoNoLote" DROP NOT NULL;

ALTER TABLE "equipamentos"
  ADD CONSTRAINT "equipamentos_lote_posicao_consistencia_check"
  CHECK (
    ("loteId" IS NULL AND "posicaoNoLote" IS NULL)
    OR
    ("loteId" IS NOT NULL AND "posicaoNoLote" IS NOT NULL AND "posicaoNoLote" >= 0)
  );

-- The partial unique index covers assigned equipment only, matching the consistency CHECK.
DROP INDEX "equipamentos_loteId_posicaoNoLote_key";
CREATE UNIQUE INDEX "equipamentos_loteId_posicaoNoLote_key"
  ON "equipamentos" ("loteId", "posicaoNoLote")
  WHERE "loteId" IS NOT NULL AND "posicaoNoLote" IS NOT NULL;
