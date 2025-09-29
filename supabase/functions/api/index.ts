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

        if (endpoint === 'originals') {
          const brandId = url.searchParams.get('brandId');
          const typeId = url.searchParams.get('typeId');
          const scanned = url.searchParams.get('scanned');
          const cursor = url.searchParams.get('cursor');
          const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);

          let query = supabase.from('originals').select(`
            *,
            brands (name),
            types (name)
          `);

          if (brandId) query = query.eq('brand_id', brandId);
          if (typeId) query = query.eq('type_id', typeId);
          if (scanned === '0') query = query.eq('scanned', false);
          if (scanned === '1') query = query.eq('scanned', true);
          if (cursor) query = query.lt('id', cursor);

          const { data, error } = await query
            .order('created_at', { ascending: false })
            .limit(limit);

          if (error) throw error;

          const items = data.map(item => ({
            ...item,
            rid: item.id.substring(0, 8)
          }));

          const nextCursor = items.length === limit ? items[items.length - 1].id : null;

          return new Response(
            JSON.stringify({ items, nextCursor }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (endpoint === 'count' && pathParts.includes('originals')) {
          const brandId = url.searchParams.get('brandId');
          const typeId = url.searchParams.get('typeId');
          const scanned = url.searchParams.get('scanned');

          let query = supabase.from('originals').select('*', { count: 'exact', head: true });

          if (brandId) query = query.eq('brand_id', brandId);
          if (typeId) query = query.eq('type_id', typeId);
          if (scanned === '0') query = query.eq('scanned', false);
          if (scanned === '1') query = query.eq('scanned', true);

          const { count, error } = await query;
          if (error) throw error;

          return new Response(
            JSON.stringify({ count: count || 0 }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (endpoint === 'replicas') {
          const brandId = url.searchParams.get('brandId');
          const typeId = url.searchParams.get('typeId');
          const batchId = url.searchParams.get('batchId');
          const scanned = url.searchParams.get('scanned');
          const cursor = url.searchParams.get('cursor');
          const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);

          // 从请求头获取前端域名
          const origin = req.headers.get('origin') || req.headers.get('referer')?.replace(/\/[^\/]*$/, '') || 'https://727de735-cc70-42ed-a3f9-80607a44faa1.lovableproject.com';

          let query = supabase.from('replicas').select(`
            *,
            brands (name),
            types (name)
          `);

          if (brandId && brandId !== 'all') query = query.eq('brand_id', brandId);
          if (typeId && typeId !== 'all') query = query.eq('type_id', typeId);
          if (batchId) query = query.eq('batch_id', batchId);
          if (scanned === '0') query = query.eq('scanned', false);
          if (scanned === '1') query = query.eq('scanned', true);
          if (cursor) query = query.lt('id', cursor);

          const { data, error } = await query
            .order('created_at', { ascending: false })
            .limit(limit);

          if (error) throw error;

          const items = data.map(item => ({
            ...item,
            rid: item.id,
            url: `${origin}/r/${item.token}`
          }));

          const nextCursor = items.length === limit ? items[items.length - 1].id : null;

          return new Response(
            JSON.stringify({ items, nextCursor }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }



        break;

      case 'DELETE':
        if (endpoint === 'bulk-delete' && pathParts.includes('originals')) {
          const { brandId, typeId } = await req.json();
          
          if (!brandId || !typeId || brandId === 'all' || typeId === 'all') {
            return new Response(
              JSON.stringify({ ok: false, msg: '请选择具体的品牌和类型进行删除' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // 先查询要删除的原始码数量
          const { count: deleteCount } = await supabase
            .from('originals')
            .select('*', { count: 'exact', head: true })
            .eq('brand_id', brandId)
            .eq('type_id', typeId);

          // 执行删除
          await supabase
            .from('originals')
            .delete()
            .eq('brand_id', brandId)
            .eq('type_id', typeId);

          return new Response(
            JSON.stringify({ ok: true, deleted: deleteCount || 0 }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (endpoint === 'bulk-delete' && pathParts.includes('replicas')) {
          const { brandId, typeId } = await req.json();
          
          if (!brandId || !typeId || brandId === 'all' || typeId === 'all') {
            return new Response(
              JSON.stringify({ ok: false, msg: '请选择具体的品牌和类型进行删除' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // 先查询要删除的副本数量
          const { count: deleteCount } = await supabase
            .from('replicas')
            .select('*', { count: 'exact', head: true })
            .eq('brand_id', brandId)
            .eq('type_id', typeId);

          // 首先清空 originals 中的 replica_id
          await supabase
            .from('originals')
            .update({ replica_id: null, scanned: false, scanned_at: null })
            .eq('brand_id', brandId)
            .eq('type_id', typeId);

          // 然后删除副本
          await supabase
            .from('replicas')
            .delete()
            .eq('brand_id', brandId)
            .eq('type_id', typeId);

          return new Response(
            JSON.stringify({ ok: true, deleted: deleteCount || 0 }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

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

        if (endpoint === 'originals') {
          const { brandId, typeId, url } = await req.json();
          
          if (!brandId || !typeId || !url) {
            return new Response(
              JSON.stringify({ ok: false, msg: '品牌ID、类型ID和URL不能为空' }),
              { 
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            );
          }

          // 检查是否已存在相同URL
          const { data: existing } = await supabase
            .from('originals')
            .select('id')
            .eq('url', url)
            .eq('brand_id', brandId)
            .eq('type_id', typeId)
            .single();

          if (existing) {
            return new Response(
              JSON.stringify({ ok: true, msg: '已存在，略过' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const { data, error } = await supabase
            .from('originals')
            .insert({ brand_id: brandId, type_id: typeId, url })
            .select()
            .single();

          if (error) throw error;

          return new Response(
            JSON.stringify({ ok: true, id: data.id }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (endpoint === 'generate' && pathParts.includes('replicas')) {
          const { brandId, typeId, count } = await req.json();
          
          if (!brandId || !typeId || !count) {
            return new Response(
              JSON.stringify({ ok: false, msg: '品牌ID、类型ID和数量不能为空' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const replicaCount = Math.min(Math.max(parseInt(count), 1), 1000);

          // 检查原始码库存
          const { count: originalCount } = await supabase
            .from('originals')
            .select('*', { count: 'exact', head: true })
            .eq('brand_id', brandId)
            .eq('type_id', typeId)
            .eq('scanned', false);

          if (!originalCount || originalCount === 0) {
            return new Response(
              JSON.stringify({ ok: false, msg: '该品牌-类型暂无原始码库存，未生成副本' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // 创建批次
          const { data: batch, error: batchError } = await supabase
            .from('batches')
            .insert({ brand_id: brandId, type_id: typeId, count: replicaCount })
            .select()
            .single();

          if (batchError) throw batchError;

          // 生成副本码
          const replicas = [];
          for (let i = 0; i < replicaCount; i++) {
            replicas.push({
              brand_id: brandId,
              type_id: typeId,
              token: crypto.randomUUID().replace(/-/g, '').substring(0, 16),
              batch_id: batch.id
            });
          }

          const { error: replicasError } = await supabase
            .from('replicas')
            .insert(replicas);

          if (replicasError) throw replicasError;

          return new Response(
            JSON.stringify({ ok: true, batchId: batch.id }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (endpoint === 'bulk-delete' && pathParts.includes('replicas')) {
          const { brandId, typeId, deleteOriginals } = await req.json();
          
          // 构建查询条件
          let replicaQuery = supabase.from('replicas').delete();
          let originalQuery = deleteOriginals 
            ? supabase.from('originals').delete()
            : supabase.from('originals').update({ replica_id: null, scanned: false, scanned_at: null });

          // 添加筛选条件
          if (brandId && brandId !== 'all') {
            replicaQuery = replicaQuery.eq('brand_id', brandId);
            originalQuery = originalQuery.eq('brand_id', brandId);
          }
          if (typeId && typeId !== 'all') {
            replicaQuery = replicaQuery.eq('type_id', typeId);
            originalQuery = originalQuery.eq('type_id', typeId);
          }

          // 执行删除操作
          if (!deleteOriginals) {
            // 先更新原始码状态
            await originalQuery;
          }

          // 删除副本 - 先查询要删除的记录数
          let countQuery = supabase.from('replicas').select('*', { count: 'exact', head: true });
          
          // 添加相同的筛选条件
          if (brandId && brandId !== 'all') {
            countQuery = countQuery.eq('brand_id', brandId);
          }
          if (typeId && typeId !== 'all') {
            countQuery = countQuery.eq('type_id', typeId);
          }

          const { count: deleteCount } = await countQuery;

          // 执行删除
          await replicaQuery;

          // 如果需要删除原始码，在删除副本后执行
          if (deleteOriginals) {
            await originalQuery;
          }

          return new Response(
            JSON.stringify({ ok: true, deleted: deleteCount || 0 }),
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