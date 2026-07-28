ALTER TABLE buddy_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE buddy_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE grounding_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_own_buddy_conversations ON buddy_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY insert_own_buddy_conversations ON buddy_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY update_own_buddy_conversations ON buddy_conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY delete_own_buddy_conversations ON buddy_conversations FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY select_own_buddy_messages ON buddy_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY insert_own_buddy_messages ON buddy_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY select_own_grounding_sessions ON grounding_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY insert_own_grounding_sessions ON grounding_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY select_own_export_requests ON export_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY insert_own_export_requests ON export_requests FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY select_own_deletion_requests ON deletion_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY insert_own_deletion_requests ON deletion_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY update_own_deletion_requests ON deletion_requests FOR UPDATE USING (auth.uid() = user_id);
