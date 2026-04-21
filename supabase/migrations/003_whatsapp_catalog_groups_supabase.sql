-- Complemento Supabase para whatsapp_catalog_groups (executar após 002).
-- SQL Editor → Run. Idempotente: seguro re-correr.

-- Integridade: JID de grupo Evolution típico termina em @g.us
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_catalog_groups_group_jid_suffix'
  ) THEN
    ALTER TABLE whatsapp_catalog_groups
      ADD CONSTRAINT whatsapp_catalog_groups_group_jid_suffix
      CHECK (group_jid LIKE '%@g.us');
  END IF;
END $$;

-- updated_at automático em qualquer UPDATE (além do que a app já define)
CREATE OR REPLACE FUNCTION public.pulseboard_touch_whatsapp_catalog_groups_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_catalog_groups_updated_at
  ON public.whatsapp_catalog_groups;

CREATE TRIGGER trg_whatsapp_catalog_groups_updated_at
  BEFORE UPDATE ON public.whatsapp_catalog_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.pulseboard_touch_whatsapp_catalog_groups_updated_at();

COMMENT ON COLUMN whatsapp_catalog_groups.group_jid IS 'JID do grupo (ex. 120363...@g.us)';
COMMENT ON COLUMN whatsapp_catalog_groups.subject IS 'Nome do grupo (Evolution findGroupInfos ou edição manual)';
COMMENT ON COLUMN whatsapp_catalog_groups.monitoring_enabled IS 'false = ignorar eventos e não actualizar esta linha';
COMMENT ON COLUMN whatsapp_catalog_groups.last_activity_at IS 'Último evento útil do webhook';
COMMENT ON COLUMN whatsapp_catalog_groups.last_event_type IS 'Tipo de evento Evolution (debug/UI)';
COMMENT ON COLUMN whatsapp_catalog_groups.last_push_name IS 'pushName recente (debug/UI)';
COMMENT ON COLUMN whatsapp_catalog_groups.last_preview IS 'Pré-visualização curta da mensagem (debug/UI)';
COMMENT ON COLUMN whatsapp_catalog_groups.updated_at IS 'Última alteração à linha';
