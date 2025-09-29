import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 验证管理员session
async function verifySession(req: Request) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const cookies = req.headers.get('cookie');
  const sessionId = cookies?.split(';')
    .find(c => c.trim().startsWith('sid='))
    ?.split('=')[1];

  if (!sessionId) {
    return null;
  }

  const { data: session, error } = await supabase
    .from('admin_sessions')
    .select('*')
    .eq('session_id', sessionId)
    .gt('expires_at', new Date().toISOString())
    .single();

  return error || !session ? null : session;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(p => p);
  const endpoint = pathParts[pathParts.length - 1];

  try {
    // 验证session
    const session = await verifySession(req);
    if (!session) {
      return new Response(
        JSON.stringify({ ok: false, msg: '未授权' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    switch (req.method) {
      case 'GET':
        if (endpoint === 'stats') {
          // 获取统计数据
          const [brandsRes, typesRes, originalsRes, originalsFreeRes, replicasRes, replicasScannedRes] = await Promise.all([
            supabase.from('brands').select('*', { count: 'exact', head: true }),
            supabase.from('types').select('*', { count: 'exact', head: true }),
            supabase.from('originals').select('*', { count: 'exact', head: true }),
            supabase.from('originals').select('*', { count: 'exact', head: true }).eq('scanned', false),
            supabase.from('replicas').select('*', { count: 'exact', head: true }),
            supabase.from('replicas').select('*', { count: 'exact', head: true }).eq('scanned', true),
          ]);

          return new Response(
            JSON.stringify({
              brands: brandsRes.count || 0,
              types: typesRes.count || 0,
              originals: originalsRes.count || 0,
              originalsFree: originalsFreeRes.count || 0,
              replicas: replicasRes.count || 0,
              replicasScanned: replicasScannedRes.count || 0,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (endpoint === 'brands') {
          const { data, error } = await supabase
            .from('brands')
            .select('*')
            .order('name');

          if (error) throw error;

          return new Response(
            JSON.stringify(data),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (endpoint === 'types') {
          const brandId = url.searchParams.get('brandId');
          let query = supabase.from('types').select(`
            *,
            brands (name)
          `);

          if (brandId) {
            query = query.eq('brand_id', brandId);
          }

          const { data, error } = await query.order('name');
          if (error) throw error;

          return new Response(
            JSON.stringify(data),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        break;

      case 'POST':
        if (endpoint === 'brands') {
          const { name } = await req.json();
          
          if (!name) {
            return new Response(
              JSON.stringify({ ok: false, msg: '品牌名称不能为空' }),
              { 
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            );
          }

          const { error } = await supabase
            .from('brands')
            .insert({ name });

          if (error) {
            if (error.code === '23505') { // unique constraint violation
              return new Response(
                JSON.stringify({ ok: false, msg: '品牌已存在' }),
                { 
                  status: 400,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
              );
            }
            throw error;
          }

          return new Response(
            JSON.stringify({ ok: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (endpoint === 'types') {
          const { brandId, name } = await req.json();
          
          if (!brandId || !name) {
            return new Response(
              JSON.stringify({ ok: false, msg: '品牌ID和类型名称不能为空' }),
              { 
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            );
          }

          const { error } = await supabase
            .from('types')
            .insert({ brand_id: brandId, name });

          if (error) {
            if (error.code === '23505') {
              return new Response(
                JSON.stringify({ ok: false, msg: '类型已存在' }),
                { 
                  status: 400,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
              );
            }
            throw error;
          }

          return new Response(
            JSON.stringify({ ok: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        break;
    }

    return new Response('Not Found', { 
      status: 404,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('API error:', error);
    return new Response(
      JSON.stringify({ ok: false, msg: '服务器错误' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});