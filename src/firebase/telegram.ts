import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, SETTINGS_COLLECTION } from './config';

export const TELEGRAM_DOCUMENT_ID = 'telegram';

export const getTelegramSettings = async () => {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, TELEGRAM_DOCUMENT_ID);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${SETTINGS_COLLECTION}/${TELEGRAM_DOCUMENT_ID}`);
  }
};

export const updateTelegramSettings = async (settingsData: any) => {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, TELEGRAM_DOCUMENT_ID);
    await setDoc(docRef, {
      ...settingsData,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${SETTINGS_COLLECTION}/${TELEGRAM_DOCUMENT_ID}`);
  }
};

export interface TelegramSendResult {
  ok: boolean;
  errorCode?: number;
  description?: string;
  friendlyMessageAr?: string;
}

export const sanitizeBotToken = (rawToken: string): string => {
  let token = (rawToken || '').trim();
  const urlMatch = token.match(/api\.telegram\.org\/(?:bot)?([^\/\s]+)/i);
  if (urlMatch && urlMatch[1]) {
    token = urlMatch[1];
  }
  if (/^bot\d+:/i.test(token)) {
    token = token.replace(/^bot/i, '');
  }
  return token.trim();
};

export const sanitizeChatId = (rawChatId: string): string => {
  return (rawChatId || '').trim();
};

export const escapeTelegramHtml = (value: unknown): string => {
  const str = String(value ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

const translateTelegramError = (errorCode?: number, description?: string): string => {
  const descLower = (description || '').toLowerCase();
  if (errorCode === 401 || descLower.includes('unauthorized')) {
    return 'رمز البوت (Bot Token) غير صحيح أو غير صالح. تأكد من نسخه كاملاً من @BotFather دون زيادة أو نقصان.';
  }
  if (errorCode === 404 || descLower.includes('not found')) {
    if (descLower.includes('chat')) {
      return 'معرّف المحادثة (Chat ID) غير موجود أو لم تبدأ محادثة مع البوت بعد (اضغط /start في البوت أو أضفه كمشرف في القناة/المجموعة).';
    }
    return 'تعذر العثور على البوت — تأكد من صحة Bot Token (أرقام ثم نقطتان : ثم حروف).';
  }
  if (descLower.includes('chat not found')) {
    return 'معرّف المحادثة (Chat ID) غير صحيح، أو أنك لم تضغط Start (/start) داخل البوت، أو البوت ليس مشرفاً في القناة/المجموعة.';
  }
  if (descLower.includes('bot was blocked')) {
    return 'تم حظر البوت من قبل المستخدم في تليجرام. قم بإلغاء حظر البوت ثم اضغط /start.';
  }
  if (descLower.includes("can't initiate conversation")) {
    return 'لا يمكن للبوت بدء محادثة من تلقاء نفسه. افتح البوت في تليجرام واضغط /start أولاً.';
  }
  if (descLower.includes("bots can't send messages to bots")) {
    return 'الـ Chat ID المدخل يعود لبوت آخر! استخدم Chat ID لحسابك الشخصي أو لمجموعة/قناة.';
  }
  if (descLower.includes('upgraded to a supergroup')) {
    return 'تمت ترقية المجموعة إلى Supergroup في تليجرام. استخدم الـ Chat ID الجديد الذي يبدأ بـ -100.';
  }
  if (descLower.includes('have no rights') || descLower.includes('not enough rights') || descLower.includes('need administrator rights')) {
    return 'البوت لا يملك صلاحية إرسال الرسائل في المجموعة أو القناة. عيّن البوت كمشرف (Admin) بصلاحية إرسال الرسائل.';
  }
  if (descLower.includes("can't parse entities")) {
    return 'خطأ في تنسيق نص الرسالة (HTML).';
  }
  return description
    ? `رفض تليجرام الإرسال: ${description}`
    : 'فشل إرسال الرسالة. يرجى التحقق من صحة الـ Bot Token ومعرّف Chat ID.';
};

export const sendTelegramMessageDetailed = async (
  botToken: string,
  chatId: string,
  text: string
): Promise<TelegramSendResult> => {
  const cleanToken = sanitizeBotToken(botToken);
  const cleanChatId = sanitizeChatId(chatId);

  if (!cleanToken || !cleanChatId) {
    return {
      ok: false,
      description: 'Missing botToken or chatId',
      friendlyMessageAr: 'يرجى إدخال كل من Bot Token و Chat ID بشكل صحيح.',
    };
  }

  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(cleanToken)) {
    return {
      ok: false,
      description: 'Invalid bot token format',
      friendlyMessageAr: 'صيغة الـ Bot Token غير صحيحة. يجب أن تكون بالشكل: 123456789:ABCdef... (دون كلمة bot في البداية).',
    };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${cleanToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text: text,
        parse_mode: 'HTML',
      }),
    });
    const result = await response.json();
    if (result && result.ok === true) {
      return { ok: true };
    }
    const errorCode = result?.error_code ?? response.status;
    const description = result?.description || `HTTP ${response.status}`;
    return {
      ok: false,
      errorCode,
      description,
      friendlyMessageAr: translateTelegramError(errorCode, description),
    };
  } catch (error) {
    console.error('Error sending message to Telegram:', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      description: errMsg,
      friendlyMessageAr: 'تعذر الاتصال بخوادم تليجرام (api.telegram.org). تحقق من اتصال الإنترنت أو مانع الإعلانات.',
    };
  }
};

export const sendTelegramMessage = async (botToken: string, chatId: string, text: string): Promise<boolean> => {
  const res = await sendTelegramMessageDetailed(botToken, chatId, text);
  return res.ok;
};

export const sendTelegramNotificationIfNeeded = async (orderId: string, orderData: any) => {
  try {
    const settings = await getTelegramSettings();
    if (!settings || !settings.enabled) {
      return;
    }

    let botToken = '';
    let chatId = '';

    if (orderData && orderData.assignedBot && orderData.assignedBot.botToken && orderData.assignedBot.chatId) {
      // 1. Backward Compatibility: Old orders containing full bot details directly
      botToken = orderData.assignedBot.botToken;
      chatId = orderData.assignedBot.chatId;
    } else if (orderData && orderData.assignedBotId) {
      // 2. New refactored design: Find by assignedBotId in settings' bots array
      const matchedBot = (settings.bots || []).find((b: any) => b.id === orderData.assignedBotId);
      if (matchedBot && matchedBot.botToken && matchedBot.chatId) {
        botToken = matchedBot.botToken;
        chatId = matchedBot.chatId;
      } else {
        // Fallback to primary settings credentials if bot not found or has been deleted
        botToken = settings.botToken;
        chatId = settings.chatId;
      }
    } else {
      // 3. Fallback or legacy order without specific assigned bot
      botToken = settings.botToken;
      chatId = settings.chatId;
    }

    const cleanToken = sanitizeBotToken(botToken);
    const cleanChatId = sanitizeChatId(chatId);
    if (!cleanToken || !cleanChatId) {
      console.warn('Telegram notification skipped: missing botToken or chatId.');
      return;
    }

    const customer = orderData.customerInfo || {};
    const fullName = escapeTelegramHtml(customer.fullName || 'غير معروف');
    const phone = escapeTelegramHtml(customer.phone || 'غير محدد');
    const state = escapeTelegramHtml(customer.state || customer.stateCity || 'غير محدد');
    const city = customer.city ? escapeTelegramHtml(customer.city) : '';
    const items = orderData.items || [];
    
    const productsText = items.map((item: any, idx: number) => {
      const name = escapeTelegramHtml(item.name || item.title || 'منتج غير معروف');
      const qty = item.quantity || 1;
      const price = item.price || 0;
      
      if (item.bundleItems && item.bundleItems.length > 0) {
        const bundleLines = item.bundleItems.map((bi: any, bIdx: number) => {
          const opts = [];
          if (bi.color) opts.push(escapeTelegramHtml(bi.color));
          if (bi.size) opts.push(escapeTelegramHtml(bi.size));
          return `      ${bIdx + 1}. ${opts.length > 0 ? opts.join(' / ') : '...'}`;
        }).join('\n');
        return `  ${idx + 1}. <b>${name}</b>\n      <b>Bundle: ${qty} Pieces</b>\n${bundleLines}\n      السعر: ${price} دج`;
      }
      
      const size = item.size || item.selectedSize;
      const color = item.color || item.selectedColor;
      
      const options = [];
      if (size) options.push(`مقاس: ${escapeTelegramHtml(size)}`);
      if (color) options.push(`لون: ${escapeTelegramHtml(color)}`);
      const optionsStr = options.length > 0 ? ` (${options.join(' - ')})` : '';
      
      return `  ${idx + 1}. <b>${name}</b>${optionsStr}\n      الكمية: ${qty} | السعر: ${price} دج`;
    }).join('\n\n');

    const total = orderData.totalPrice || 0;
    const dateStr = escapeTelegramHtml(new Date().toLocaleString('ar-DZ', { timeZone: 'Africa/Algiers' }));
    const orderNumValue = escapeTelegramHtml(orderData.orderNumber || orderId);

    const deliveryType = orderData.deliveryType;
    let deliveryTypeText = '';
    if (deliveryType) {
      const dtLower = String(deliveryType).toLowerCase();
      if (dtLower.includes('home')) {
        deliveryTypeText = 'توصيل للمنزل';
      } else if (dtLower.includes('pickup') || dtLower.includes('desk') || dtLower.includes('office')) {
        deliveryTypeText = 'توصيل للمكتب / نقطة استلام';
      } else {
        deliveryTypeText = escapeTelegramHtml(deliveryType);
      }
    }

    const messageText = `🔹 <b>طلب جديد من المتجر!</b> 🔹\n\n` +
      `📦 <b>رقم الطلب:</b> <code>${orderNumValue}</code>\n` +
      `👤 <b>اسم العميل:</b> ${fullName}\n` +
      `📞 <b>الهاتف:</b> ${phone}\n` +
      `📍 <b>الولاية:</b> ${state}\n` +
      (city ? `🏙️ <b>البلدية:</b> ${city}\n` : '') +
      (deliveryTypeText ? `🚚 <b>نوع التوصيل:</b> ${deliveryTypeText}\n` : '') +
      `\n🛍️ <b>المنتجات المطلوبة:</b>\n${productsText}\n\n` +
      `💰 <b>الإجمالي:</b> <b>${total} دج</b>\n` +
      `⏰ <b>وقت الطلب:</b> ${dateStr}`;

    const sendRes = await sendTelegramMessageDetailed(cleanToken, cleanChatId, messageText);
    if (!sendRes.ok) {
      console.error('Telegram API rejected order notification:', sendRes.errorCode, sendRes.description);
    }
  } catch (err) {
    console.error('Failed to send Telegram notification:', err);
  }
};
