import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  const token = pathParts[pathParts.length - 1]; // 获取最后一部分作为token

  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // 查找副本记录
    const { data: replica, error: replicaError } = await supabase
      .from('replicas')
      .select('*')
      .eq('token', token)
      .single();

    if (replicaError || !replica) {
      return new Response('Not Found', { 
        status: 404,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // 检查是否已绑定原始码
    if (replica.bound_original_id) {
      // 已绑定，获取原始码URL并跳转
      const { data: original, error: originalError } = await supabase
        .from('originals')
        .select('url')
        .eq('id', replica.bound_original_id)
        .single();

      if (originalError || !original) {
        return new Response('Original missing', { 
          status: 410,
          headers: { 'Content-Type': 'text/plain' }
        });
      }

      // 执行302跳转，支持最多3次跟随
      return await followRedirects(original.url, 3);
    }

    // 未绑定，开始事务绑定流程
    const result = await supabase.rpc('bind_replica_to_original', {
      p_replica_id: replica.id,
      p_brand_id: replica.brand_id,
      p_type_id: replica.type_id
    });

    if (result.error) {
      console.error('Binding error:', result.error);
      return new Response('No available original QR for this brand/type', { 
        status: 404,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    const bindingData = result.data;
    if (!bindingData || !bindingData.original_url) {
      return new Response('No available original QR for this brand/type', { 
        status: 404,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // 执行302跳转
    return await followRedirects(bindingData.original_url, 3);

  } catch (error) {
    console.error('Redirect error:', error);
    return new Response('Internal Server Error', { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
});

// 跟随重定向的函数
async function followRedirects(url: string, maxRedirects: number): Promise<Response> {
  let currentUrl = url;
  let redirectCount = 0;

  try {
    while (redirectCount < maxRedirects) {
      const response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual'
      });

      // 如果是重定向状态码
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('Location');
        if (!location) {
          break;
        }
        
        currentUrl = new URL(location, currentUrl).toString();
        redirectCount++;
        continue;
      }

      // 非重定向响应，返回内容
      const contentType = response.headers.get('Content-Type') || 'text/html';
      const content = await response.arrayBuffer();
      
      const headers = new Headers();
      headers.set('Content-Type', contentType);
      // 移除可能导致问题的头部
      const excludeHeaders = ['content-length', 'transfer-encoding'];
      for (const [key, value] of response.headers.entries()) {
        if (!excludeHeaders.includes(key.toLowerCase())) {
          headers.set(key, value);
        }
      }

      return new Response(content, {
        status: response.status,
        headers
      });
    }

    // 达到最大重定向次数，回退到简单302
    return Response.redirect(currentUrl, 302);

  } catch (error) {
    // 出错时回退到简单302
    console.error('Follow redirects error:', error);
    return Response.redirect(currentUrl, 302);
  }
}