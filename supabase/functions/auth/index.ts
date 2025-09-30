import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 获取环境变量中的管理员凭据
const ADMIN_USER = Deno.env.get('ADMIN_USER') || 'admin';
const ADMIN_PASS = Deno.env.get('ADMIN_PASS') || 'admin123';

interface SessionData {
  id: string;
  session_id: string;
  username: string;
  created_at: string;
  expires_at: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();

  try {
    switch (req.method) {
      case 'POST':
        if (path === 'login') {
          const { username, password } = await req.json();
          
          // 验证凭据
          if (username !== ADMIN_USER || password !== ADMIN_PASS) {
            return new Response(
              JSON.stringify({ ok: false, msg: '用户名或密码错误' }),
              { 
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            );
          }

          // 生成session ID
          const sessionId = crypto.randomUUID();
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小时后过期

          // 保存session到数据库
          const { error } = await supabase
            .from('admin_sessions')
            .insert({
              session_id: sessionId,
              username: username,
              expires_at: expiresAt.toISOString()
            });

          if (error) {
            console.error('Session creation error:', error);
            return new Response(
              JSON.stringify({ ok: false, msg: '登录失败' }),
              { 
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            );
          }

          // 设置cookie
          const response = new Response(
            JSON.stringify({ ok: true }),
            { 
              headers: { 
                ...corsHeaders, 
                'Content-Type': 'application/json',
                'Set-Cookie': `sid=${sessionId}; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax; Secure`
              }
            }
          );

          return response;
        }

        if (path === 'logout') {
          const cookies = req.headers.get('cookie');
          const sessionId = cookies?.split(';')
            .find(c => c.trim().startsWith('sid='))
            ?.split('=')[1];

          if (sessionId) {
            // 删除session
            await supabase
              .from('admin_sessions')
              .delete()
              .eq('session_id', sessionId);
          }

          return new Response(
            JSON.stringify({ ok: true }),
            { 
              headers: { 
                ...corsHeaders, 
                'Content-Type': 'application/json',
                'Set-Cookie': 'sid=; HttpOnly; Path=/; Max-Age=0'
              }
            }
          );
        }
        break;

      case 'GET':
        if (path === 'me') {
          const cookies = req.headers.get('cookie');
          const sessionId = cookies?.split(';')
            .find(c => c.trim().startsWith('sid='))
            ?.split('=')[1];

          if (!sessionId) {
            return new Response(
              JSON.stringify({ ok: false }),
              { 
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            );
          }

          // 验证session
          const { data: session, error } = await supabase
            .from('admin_sessions')
            .select('*')
            .eq('session_id', sessionId)
            .gt('expires_at', new Date().toISOString())
            .single();

          if (error || !session) {
            return new Response(
              JSON.stringify({ ok: false }),
              { 
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            );
          }

          return new Response(
            JSON.stringify({ 
              ok: true, 
              user: { username: session.username } 
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
        break;
    }

    return new Response('Not Found', { 
      status: 404,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Auth error:', error);
    return new Response(
      JSON.stringify({ ok: false, msg: '服务器错误' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});