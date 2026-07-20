
CREATE POLICY "chat_att_read" ON storage.objects FOR SELECT
  TO authenticated USING (bucket_id = 'chat-attachments');
CREATE POLICY "chat_att_insert" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'chat-attachments' AND owner = auth.uid());
CREATE POLICY "chat_att_delete" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'chat-attachments' AND owner = auth.uid());
