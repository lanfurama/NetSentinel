import pool from './connection.js';

export async function ensureChatTablesExist() {
  try {
    // Check if chat_messages table exists
    const checkMessages = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'chat_messages'
      );
    `);

    if (!checkMessages.rows[0].exists) {
      console.log('📝 Creating chat_messages table...');
      
      await pool.query(`
        CREATE TABLE chat_messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR(100) NOT NULL,
          role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'model')),
          content TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_message_user FOREIGN KEY (user_id) REFERENCES users(username) ON DELETE CASCADE
        );
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id);
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at DESC);
      `);

      console.log('✅ chat_messages table created');
    }

    console.log('✅ Chat tables initialized');
  } catch (error: any) {
    console.error('❌ Error initializing chat tables:', error.message);
    // Don't throw - let the app continue even if tables already exist
  }
}
