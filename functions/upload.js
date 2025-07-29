/**
 * 生成指定长度的随机字符串，用于文件名
 * @param {number} length - 字符串长度
 * @returns {string}
 */
function generateRandomString(length) {
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

/**
 * 处理POST请求的核心函数
 */
export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    // 1. 验证认证码
    // 从环境变量中获取预设的密码
    const authKey = env.AUTH_KEY;
    // 从请求头中获取客户端传来的密码
    const clientKey = request.headers.get('Authorization');

    // 如果没有设置密码，或者客户端密码不匹配，则拒绝访问
    if (!authKey || clientKey !== authKey) {
      return new Response('Unauthorized', { status: 401 });
    }

    // 2. 获取 R2 的公开访问 URL
    const publicUrl = env.R2_PUBLIC_URL;
    if (!publicUrl) {
        return new Response('R2_PUBLIC_URL environment variable is not set', { status: 500 });
    }

    // 3. 处理上传的文件
    const blob = await request.blob();
    const contentType = request.headers.get('content-type') || 'image/png';
    const fileExtension = contentType.split('/')[1] || 'png';

    // 4. 生成唯一文件名
    // 格式：日期(YYYYMMDD)-随机字符串.扩展名
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    const randomStr = generateRandomString(8);
    const fileName = `${dateStr}-${randomStr}.${fileExtension}`;

    // 5. 将文件上传到 R2 存储桶
    await env.IMG.put(fileName, blob, {
      httpMetadata: { contentType },
    });

    // 6. 构造并返回图片外链
    const imageUrl = `${publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl}/${fileName}`;
    
    // Gemini Balance 项目需要特定的 JSON 格式返回
    const responseBody = {
        code: 200,
        message: "success",
        data: {
            url: imageUrl
        }
    };

    return new Response(JSON.stringify(responseBody), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Upload Error:', error);
    return new Response(`Server Error: ${error.message}`, { status: 500 });
  }
}