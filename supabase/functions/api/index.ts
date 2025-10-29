import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

// 动态获取CORS headers
function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin');
  const allowedOrigins = [
    'https://babel-quest.lovable.app',
    'http://localhost:5173',
    'http://127.0.0.1:5173'
  ];
  
  // 检查是否是 lovableproject.com 子域名
  const isLovableProject = origin && origin.includes('lovableproject.com');
  const isAllowed = allowedOrigins.includes(origin || '') || isLovableProject;
  
  return {
    'Access-Control-Allow-Origin': isAllowed && origin ? origin : 'https://babel-quest.lovable.app',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// Input validation schemas
const brandSchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'Brand name cannot be empty')
    .max(100, 'Brand name too long')
    .regex(/^[a-zA-Z0-9\s\-_一-龥]+$/, 'Invalid characters in brand name')
});

const typeSchema = z.object({
  brand_id: z.string().uuid('Invalid brand ID'),
  name: z.string()
    .trim()
    .min(1, 'Type name cannot be empty')
    .max(100, 'Type name too long')
});

const originalSchema = z.object({
  brand_id: z.string().uuid('Invalid brand ID'),
  type_id: z.string().uuid('Invalid type ID'),
  url: z.string()
    .url('Invalid URL format')
    .max(2048, 'URL too long')
});

const replicaGenerateSchema = z.object({
  brandId: z.string().uuid('Invalid brand ID'),
  typeId: z.string().uuid('Invalid type ID'),
  count: z.number()
    .int('Count must be an integer')
    .min(1, 'Count must be at least 1')
    .max(10000, 'Count cannot exceed 10,000')
});

// Helper function to validate input
function validateInput<T>(schema: z.ZodSchema<T>, data: any, corsHeaders: HeadersInit): { valid: true; data: T } | { valid: false; response: Response } {
  try {
    const validated = schema.parse(data);
    return { valid: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        response: new Response(
          JSON.stringify({ 
            ok: false, 
            errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      };
    }
    return {
      valid: false,
      response: new Response(
        JSON.stringify({ ok: false, error: 'Invalid input' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    };
  }
}

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

    // 构建查询条件 - 只查询未扫描的副本
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
      `)
      .eq('scanned', false); // 只导出未扫描的副本

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
    const csvRows = ['序号,Token,QR码链接,品牌,类型,创建时间'];
    
    for (let i = 0; i < replicas.length; i++) {
      const replica = replicas[i];
      const qrUrl = `https://isfxgcfocfctwixklbvw.supabase.co/functions/v1/redirect/r/${replica.token}`;
      const createdAt = new Date(replica.created_at).toLocaleString('zh-CN');
      
      csvRows.push([
        i + 1,
        replica.token,
        qrUrl,
        replica.brands?.name || '',
        replica.types?.name || '',
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

    // Generate signed URL (1 hour expiration)
    const { data: signedUrlData } = await supabase.storage
      .from('exports')
      .createSignedUrl(fileName, 3600);

    // Update job as completed with signed URL
    await supabase
      .from('export_jobs')
      .update({ 
        status: 'finished',
        file_path: fileName,
        signed_url: signedUrlData?.signedUrl || null,
        url_expires_at: new Date(Date.now() + 3600000).toISOString(),
        completed: total,
        finished_at: new Date().toISOString()
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

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize Supabase client with auth from request
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const authHeader = req.headers.get('Authorization');
  
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  });

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(p => p);
  const endpoint = pathParts[pathParts.length - 1];
  
  // 对于DELETE请求，如果路径是 /api/brands/{id} 或 /api/types/{id}
  // 需要正确识别endpoint为'brands'或'types'而不是ID
  let actualEndpoint = endpoint;
  if (req.method === 'DELETE' && pathParts.length >= 2) {
    const secondLast = pathParts[pathParts.length - 2];
    if (secondLast === 'brands' || secondLast === 'types') {
      actualEndpoint = secondLast;
    }
  }

  try {
    // Verify authentication using Supabase Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return new Response(
        JSON.stringify({ ok: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Define stats endpoint
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
          ok: true,
          stats: {
            brands: brandsRes.count || 0,
            types: typesRes.count || 0,
            originals: originalsRes.count || 0,
            originalsFree: originalsFreeRes.count || 0,
            replicas: replicasRes.count || 0,
            replicasScanned: replicasScannedRes.count || 0,
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Define brands endpoint
    if (endpoint === 'brands') {
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ ok: true, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Define types endpoint
    if (endpoint === 'types') {
      const brandId = url.searchParams.get('brandId');
      let query = supabase.from('types').select('*');
      
      if (brandId && brandId !== 'all') {
        query = query.eq('brand_id', brandId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ ok: true, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Define originals endpoint
    if (endpoint === 'originals') {
      const brandId = url.searchParams.get('brandId');
      const typeId = url.searchParams.get('typeId');
      const sortBy = url.searchParams.get('sortBy') || 'newest';
      const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
      const cursor = url.searchParams.get('cursor');
      const page = parseInt(url.searchParams.get('page') || '1');
      const useCursor = url.searchParams.get('useCursor') === 'true';

      let query = supabase
        .from('originals')
        .select('*');

      if (brandId && brandId !== 'all') {
        query = query.eq('brand_id', brandId);
      }
      if (typeId && typeId !== 'all') {
        query = query.eq('type_id', typeId);
      }

      const sortField = sortBy === 'newest' ? 'created_at' : 'scanned_at';
      const ascending = sortBy === 'oldest';
      
      if (useCursor && cursor) {
        query = query.lt('created_at', cursor);
      }

      if (!useCursor && page > 1) {
        const offset = (page - 1) * pageSize;
        query = query.range(offset, offset + pageSize - 1);
      } else {
        query = query.limit(pageSize);
      }

      query = query.order(sortField, { ascending });

      const { data, error } = await query;

      if (error) throw error;

      return new Response(
        JSON.stringify({ 
          ok: true, 
          data,
          hasMore: data && data.length === pageSize,
          nextCursor: data && data.length > 0 ? data[data.length - 1].created_at : null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Define count originals endpoint
    if (pathParts.includes('count') && pathParts.includes('originals')) {
      const brandId = url.searchParams.get('brandId');
      const typeId = url.searchParams.get('typeId');

      let query = supabase.from('originals').select('*', { count: 'exact', head: true });

      if (brandId && brandId !== 'all') {
        query = query.eq('brand_id', brandId);
      }
      if (typeId && typeId !== 'all') {
        query = query.eq('type_id', typeId);
      }

      const { count, error } = await query;

      if (error) throw error;

      return new Response(
        JSON.stringify({ ok: true, count: count || 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Define replicas endpoint
    if (endpoint === 'replicas') {
      const brandId = url.searchParams.get('brandId');
      const typeId = url.searchParams.get('typeId');
      const scannedStatus = url.searchParams.get('scannedStatus');
      const sortBy = url.searchParams.get('sortBy') || 'newest';
      const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
      const cursor = url.searchParams.get('cursor');
      const page = parseInt(url.searchParams.get('page') || '1');
      const useCursor = url.searchParams.get('useCursor') === 'true';

      let query = supabase
        .from('replicas')
        .select('*, brands(name), types(name)');

      if (brandId && brandId !== 'all') {
        query = query.eq('brand_id', brandId);
      }
      if (typeId && typeId !== 'all') {
        query = query.eq('type_id', typeId);
      }
      if (scannedStatus && scannedStatus !== 'all') {
        query = query.eq('scanned', scannedStatus === 'true');
      }

      const sortField = sortBy === 'newest' ? 'created_at' : 'scanned_at';
      const ascending = sortBy === 'oldest';
      
      if (useCursor && cursor) {
        query = query.lt('created_at', cursor);
      }

      if (!useCursor && page > 1) {
        const offset = (page - 1) * pageSize;
        query = query.range(offset, offset + pageSize - 1);
      } else {
        query = query.limit(pageSize);
      }

      query = query.order(sortField, { ascending });

      const { data, error } = await query;

      if (error) throw error;

      const transformedData = data?.map(replica => ({
        ...replica,
        url: `https://isfxgcfocfctwixklbvw.supabase.co/functions/v1/redirect/r/${replica.token}`,
        brandName: replica.brands?.name || '',
        typeName: replica.types?.name || ''
      }));

      return new Response(
        JSON.stringify({ 
          ok: true, 
          data: transformedData,
          hasMore: data && data.length === pageSize,
          nextCursor: data && data.length > 0 ? data[data.length - 1].created_at : null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Define replica_export_jobs endpoint
    if (pathParts.includes('replica_export_jobs')) {
      const jobId = pathParts[pathParts.length - 1];
      
      if (jobId && jobId !== 'replica_export_jobs') {
        // If a specific export job is requested, get it
        const { data: job, error: jobError } = await supabase
          .from('export_jobs')
          .select('*')
          .eq('id', jobId)
          .single();

        if (jobError) {
          return new Response(
            JSON.stringify({ ok: false, error: jobError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Regenerate signed URL if expired
        if (job.file_path && (!job.url_expires_at || new Date(job.url_expires_at) < new Date())) {
          const { data: signedUrlData } = await supabase.storage
            .from('exports')
            .createSignedUrl(job.file_path, 3600);

          if (signedUrlData?.signedUrl) {
            job.signed_url = signedUrlData.signedUrl;
            job.url_expires_at = new Date(Date.now() + 3600000).toISOString();

            // Update in database
            await supabase
              .from('export_jobs')
              .update({
                signed_url: job.signed_url,
                url_expires_at: job.url_expires_at
              })
              .eq('id', jobId);
          }
        }

        return new Response(
          JSON.stringify({ ok: true, job }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    switch (req.method) {
      case 'GET':
        
        break;

      case 'DELETE':
        if (actualEndpoint === 'brands') {
          const id = pathParts[pathParts.length - 1];
          
          const { count: typeCount } = await supabase
            .from('types')
            .select('*', { count: 'exact', head: true })
            .eq('brand_id', id);

          if (typeCount && typeCount > 0) {
            return new Response(
              JSON.stringify({ ok: false, msg: '该品牌下还有类型，请先删除相关类型' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          await supabase.from('brands').delete().eq('id', id);

          return new Response(
            JSON.stringify({ ok: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (actualEndpoint === 'types') {
          const id = pathParts[pathParts.length - 1];
          
          const [replicasResult, originalsResult] = await Promise.all([
            supabase.from('replicas').select('*', { count: 'exact', head: true }).eq('type_id', id),
            supabase.from('originals').select('*', { count: 'exact', head: true }).eq('type_id', id)
          ]);

          if ((replicasResult.count || 0) > 0 || (originalsResult.count || 0) > 0) {
            return new Response(
              JSON.stringify({ ok: false, msg: '该类型下还有原始码或副本码，请先删除相关数据' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          await supabase.from('types').delete().eq('id', id);

          return new Response(
            JSON.stringify({ ok: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        break;

      case 'POST':
        if (endpoint === 'brands') {
          // POST /brands - Create a new brand
          const body = await req.json();
          const validation = validateInput(brandSchema, body, corsHeaders);
          if (!validation.valid) return validation.response;
          const { name } = validation.data;

          const { data, error } = await supabase
            .from('brands')
            .insert({ name })
            .select()
            .single();

          if (error) throw error;

          return new Response(
            JSON.stringify({ ok: true, data }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (endpoint === 'types') {
          // POST /types - Create a new type
          const body = await req.json();
          const validation = validateInput(typeSchema, body, corsHeaders);
          if (!validation.valid) return validation.response;
          const { brand_id, name } = validation.data;

          const { data, error } = await supabase
            .from('types')
            .insert({ brand_id, name })
            .select()
            .single();

          if (error) throw error;

          return new Response(
            JSON.stringify({ ok: true, data }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (endpoint === 'originals') {
          // POST /originals - Create original entry
          const body = await req.json();
          const validation = validateInput(originalSchema, body, corsHeaders);
          if (!validation.valid) return validation.response;
          const { brand_id, type_id, url } = validation.data;

          const { count } = await supabase
            .from('originals')
            .select('*', { count: 'exact', head: true })
            .eq('url', url);

          if (count && count > 0) {
            return new Response(
              JSON.stringify({ ok: false, msg: '该URL已存在' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const { data, error } = await supabase
            .from('originals')
            .insert({ brand_id, type_id, url })
            .select()
            .single();

          if (error) throw error;

          return new Response(
            JSON.stringify({ ok: true, data }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (endpoint === 'generate' && pathParts.includes('replicas')) {
          // POST /replicas/generate - Generate replicas
          const body = await req.json();
          const validation = validateInput(replicaGenerateSchema, body, corsHeaders);
          if (!validation.valid) return validation.response;
          const { brandId, typeId, count } = validation.data;

          const { count: availableCount } = await supabase
            .from('originals')
            .select('*', { count: 'exact', head: true })
            .eq('brand_id', brandId)
            .eq('type_id', typeId)
            .eq('scanned', false)
            .is('replica_id', null);

          if (!availableCount || availableCount < count) {
            return new Response(
              JSON.stringify({ 
                ok: false, 
                msg: `可用原始码不足，当前只有 ${availableCount || 0} 个，需要 ${count} 个` 
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const replicas = [];
          for (let i = 0; i < count; i++) {
            replicas.push({
              brand_id: brandId,
              type_id: typeId,
              token: crypto.randomUUID(),
            });
          }

          const { data, error } = await supabase
            .from('replicas')
            .insert(replicas)
            .select();

          if (error) throw error;

          return new Response(
            JSON.stringify({ ok: true, data }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (endpoint === 'bulk-delete' && pathParts.includes('replicas')) {
          const { brandId, typeId, deleteOriginals } = await req.json();
          
          if (!brandId || !typeId || brandId === 'all' || typeId === 'all') {
            return new Response(
              JSON.stringify({ ok: false, msg: '请选择具体的品牌和类型进行删除' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const { count: deleteCount } = await supabase
            .from('replicas')
            .select('*', { count: 'exact', head: true })
            .eq('brand_id', brandId)
            .eq('type_id', typeId);

          if (deleteOriginals) {
            await supabase
              .from('originals')
              .delete()
              .eq('brand_id', brandId)
              .eq('type_id', typeId);
          } else {
            await supabase
              .from('originals')
              .update({ replica_id: null, scanned: false, scanned_at: null })
              .eq('brand_id', brandId)
              .eq('type_id', typeId);
          }

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

        if (endpoint === 'bulk-delete' && pathParts.includes('originals')) {
          const { brandId, typeId } = await req.json();
          
          if (!brandId || !typeId || brandId === 'all' || typeId === 'all') {
            return new Response(
              JSON.stringify({ ok: false, msg: '请选择具体的品牌和类型进行删除' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const { count: deleteCount } = await supabase
            .from('originals')
            .select('*', { count: 'exact', head: true })
            .eq('brand_id', brandId)
            .eq('type_id', typeId);

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
