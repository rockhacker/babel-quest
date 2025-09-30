import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 导出任务处理函数
async function processExportJob(jobId: string, brandId: string | null, typeId: string | null, supabase: any) {
  try {
    console.log(`开始处理导出任务: ${jobId}`);
    
    // 更新任务状态为processing
    await supabase
      .from('export_jobs')
      .update({ 
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('id', jobId);

    // 构建查询条件
    let query = supabase
      .from('replicas')
      .select(`
        id,
        token,
        scanned,
        scanned_at,
        created_at,
        brands!inner(name),
        types!inner(name)
      `);

    // 只有当brandId和typeId不是"all"且不为空时才添加筛选条件
    if (brandId && brandId !== 'all') {
      query = query.eq('brand_id', brandId);
    }
    if (typeId && typeId !== 'all') {
      query = query.eq('type_id', typeId);
    }

    // 获取所有副本数据
    const { data: replicas, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('查询副本数据失败:', error);
      throw error;
    }

    const total = replicas?.length || 0;
    console.log(`找到 ${total} 个副本`);

    // 更新总数
    await supabase
      .from('export_jobs')
      .update({ total })
      .eq('id', jobId);

    if (total === 0) {
      await supabase
        .from('export_jobs')
        .update({ 
          status: 'finished',
          completed: 0,
          finished_at: new Date().toISOString(),
          file_path: null
        })
        .eq('id', jobId);
      return;
    }

    // 处理副本数据，生成CSV格式数据
    const csvRows = ['序号,Token,QR码链接,品牌,类型,状态,扫描时间,创建时间'];
    
    for (let i = 0; i < replicas.length; i++) {
      const replica = replicas[i];
      const qrUrl = `https://isfxgcfocfctwixklbvw.supabase.co/functions/v1/redirect/r/${replica.token}`;
      const status = replica.scanned ? '已扫描' : '未扫描';
      const scannedAt = replica.scanned_at ? new Date(replica.scanned_at).toLocaleString('zh-CN') : '';
      const createdAt = new Date(replica.created_at).toLocaleString('zh-CN');
      
      csvRows.push([
        i + 1,
        replica.token,
        qrUrl,
        replica.brands?.name || '',
        replica.types?.name || '',
        status,
        scannedAt,
        createdAt
      ].map(field => `"${field}"`).join(','));

      // 更新进度
      if ((i + 1) % 100 === 0 || i === replicas.length - 1) {
        await supabase
          .from('export_jobs')
          .update({ completed: i + 1 })
          .eq('id', jobId);
      }
    }

    const csvContent = csvRows.join('\n');
    const fileName = `replica_export_${jobId}_${new Date().toISOString().slice(0, 10)}.csv`;
    
    // 将CSV文件上传到存储桶
    const { error: uploadError } = await supabase.storage
      .from('exports')
      .upload(fileName, csvContent, {
        contentType: 'text/csv; charset=utf-8',
        upsert: true
      });

    if (uploadError) {
      console.error('文件上传失败:', uploadError);
      throw uploadError;
    }

    // 获取文件的公共URL
    const { data: urlData } = supabase.storage
      .from('exports')
      .getPublicUrl(fileName);

    await supabase
      .from('export_jobs')
      .update({ 
        status: 'finished',
        completed: total,
        finished_at: new Date().toISOString(),
        file_path: urlData.publicUrl
      })
      .eq('id', jobId);

    console.log(`导出任务 ${jobId} 完成，文件保存为: ${fileName}`);
    
  } catch (error) {
    console.error(`导出任务 ${jobId} 失败:`, error);
    
    await supabase
      .from('export_jobs')
      .update({ 
        status: 'failed',
        error_message: (error as any)?.message || '导出失败',
        finished_at: new Date().toISOString()
      })
      .eq('id', jobId);
  }
}

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
            url: `https://isfxgcfocfctwixklbvw.supabase.co/functions/v1/redirect/r/${item.token}`
          }));

          const nextCursor = items.length === limit ? items[items.length - 1].id : null;

          return new Response(
            JSON.stringify({ items, nextCursor }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // 查询导出任务状态
        if (pathParts.includes('replica_export_jobs') && pathParts.length > 2) {
          const jobId = pathParts[pathParts.length - 1];
          
          const { data: job, error: jobError } = await supabase
            .from('export_jobs')
            .select('*')
            .eq('id', jobId)
            .single();

          if (jobError || !job) {
            return new Response(
              JSON.stringify({ ok: false, msg: '任务未找到' }),
              { 
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            );
          }

          const progress = job.total > 0 ? Math.round((job.completed / job.total) * 100) : 0;

          return new Response(
            JSON.stringify({ 
              ok: true,
              status: job.status,
              total: job.total,
              completed: job.completed,
              progress: progress,
              downloadUrl: job.file_path,
              error: job.error_message,
              startedAt: job.started_at,
              finishedAt: job.finished_at
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }


        break;

      case 'DELETE':
        // 删除方法暂时不处理批量删除，所有批量删除都在POST方法中处理

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

        // 原始码批量删除
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

          // 删除原始码
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

        // 副本批量删除 - 增强版，支持同时删除原始码
        if (endpoint === 'bulk-delete' && pathParts.includes('replicas')) {
          const { brandId, typeId, deleteOriginals } = await req.json();
          
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

          if (deleteOriginals) {
            // 如果需要同时删除原始码，先删除原始码
            await supabase
              .from('originals')
              .delete()
              .eq('brand_id', brandId)
              .eq('type_id', typeId);
          } else {
            // 如果不删除原始码，清空原始码中的关联信息
            await supabase
              .from('originals')
              .update({ replica_id: null, scanned: false, scanned_at: null })
              .eq('brand_id', brandId)
              .eq('type_id', typeId);
          }

          // 删除副本
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

        // 原始码批量删除
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

          // 删除原始码
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

        if (endpoint === 'replica_export_jobs') {
          const { brandId, typeId, baseUrl } = await req.json();
          
          if (!brandId || !typeId) {
            return new Response(
              JSON.stringify({ ok: false, msg: '品牌ID和类型ID不能为空' }),
              { 
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            );
          }

          // 创建导出任务，如果是'all'则传null
          const insertData: any = {
            base_url: baseUrl,
            status: 'pending'
          };
          
          if (brandId !== 'all') insertData.brand_id = brandId;
          if (typeId !== 'all') insertData.type_id = typeId;

          const { data: exportJob, error: jobError } = await supabase
            .from('export_jobs')
            .insert(insertData)
            .select()
            .single();

          if (jobError) {
            console.error('Export job creation error:', jobError);
            throw jobError;
          }

          // 启动后台处理任务
          processExportJob(exportJob.id, brandId, typeId, supabase);

          return new Response(
            JSON.stringify({ 
              ok: true, 
              jobId: exportJob.id,
              status: exportJob.status 
            }),
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