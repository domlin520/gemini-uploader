/**
 * 生成指定长度的随机字符串
 */
function generateRandomString(length) {
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    // 步骤 1: 严格检查所有环境变量配置
    if (!env.IMG) {
      return new Response('Server Configuration Error: R2 binding for "IMG" is missing.', { status: 500 });
    }
    if (!env.R2_PUBLIC_URL) {
      return new Response('Server Configuration Error: "R2_PUBLIC_URL" is not set.', { status: 500 });
    }
    if (!env.AUTH_KEY) {
      return new Response('Server Configuration Error: "AUTH_KEY" is not set.', { status: 500 });
    }

    // 步骤 2: 认证
    const { searchParams } = new URL(request.url);
    const authKey = env.AUTH_KEY;
    const clientKey = request.headers.get('Authorization') || searchParams.get('authCode');

    if (clientKey !== authKey) {
      return new Response('Unauthorized. The provided key does not match.', { status: 401 });
    }

    // 步骤 3: 处理上传的文件数据
    const blob = await request.blob();
    if (blob.size === 0) {
        return new Response('Bad Request: Uploaded file is empty.', { status: 400 });
    }

    // 步骤 4: 生成唯一文件名
    const effectiveContentType = blob.type || 'image/png';
    const fileExtension = effectiveContentType.split('/')[1] || 'png';
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    const randomStr = generateRandomString(8);
    const fileName = `${dateStr}-${randomStr}.${fileExtension}`;

    // 步骤 5: 上传到 R2
    try {
        await env.IMG.put(fileName, blob, {
            httpMetadata: { contentType: effectiveContentType },
        });
    } catch (r2Error) {
        console.error('R2 Put Error:', r2Error);
        return new Response(`Failed to upload to R2 Storage: ${r2Error.message}`, { status: 500 });
    }

    // 步骤 6: 返回一个更简单的成功响应
    const publicUrl = env.R2_PUBLIC_URL;
    const imageUrl = `${publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl}/${fileName}`;
    
    // --- 这是本次唯一的修改 ---
    // 直接返回包含 url 的简单对象
    const responseBody = {
        url: imageUrl
    };

    return new Response(JSON.stringify(responseBody), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('General Upload Script Error:', error);
    return new Response(`An unexpected error occurred: ${error.message}\n${error.stack}`, { status: 500 });
  }
}
