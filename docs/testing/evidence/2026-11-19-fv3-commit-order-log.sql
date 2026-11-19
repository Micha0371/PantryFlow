-- EXPERIMENTAL (round 3, case 9): history of every state transition of account_deletion_requests, written in the same
-- transaction as the change, so ordering it by pg_xact_commit_timestamp(xid) gives the real commit order.
CREATE SCHEMA IF NOT EXISTS fv3;
CREATE TABLE fv3.row_history (
  seq bigserial PRIMARY KEY, xid xid8 NOT NULL DEFAULT pg_current_xact_id(), op text NOT NULL, user_id uuid NOT NULL,
  old_state text, old_request uuid, old_ticket uuid, new_state text, new_request uuid, new_ticket uuid);
CREATE FUNCTION fv3.log_row() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO fv3.row_history(op,user_id,new_state,new_request,new_ticket) VALUES ('INSERT',NEW.user_id,NEW.state,NEW.request_id,NEW.ticket);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO fv3.row_history(op,user_id,old_state,old_request,old_ticket,new_state,new_request,new_ticket)
      VALUES ('UPDATE',NEW.user_id,OLD.state,OLD.request_id,OLD.ticket,NEW.state,NEW.request_id,NEW.ticket);
  ELSE
    INSERT INTO fv3.row_history(op,user_id,old_state,old_request,old_ticket) VALUES ('DELETE',OLD.user_id,OLD.state,OLD.request_id,OLD.ticket);
  END IF;
  RETURN NULL;
END $f$;
-- applied only in case 9 (so that cases 1-8 and 11 run on the pure protocol)
-- CREATE TRIGGER zz_log AFTER INSERT OR UPDATE OR DELETE ON public.account_deletion_requests FOR EACH ROW EXECUTE FUNCTION fv3.log_row();
