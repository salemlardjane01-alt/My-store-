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

export const sendTelegramMessage = async (botToken: string, chatId: string, text: string): Promise<boolean> => {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
      }),
    });
    const result = await response.json();
    return result.ok === true;
  } catch (error) {
    console.error('Error sending message to Telegram:', error);
    return false;
  }
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

    if (!botToken || !chatId) {
      return;
    }

    const customer = orderData.customerInfo || {};
    const fullName = customer.fullName || 'غير معروف';
    const phone = customer.phone || 'غير محدد';
    const state = customer.state || customer.stateCity || 'غير محدد';
    const city = customer.city || '';
    const items = orderData.items || [];
    
    const productsText = items.map((item: any, idx: number) => {
      const name = item.name || item.title || 'منتج غير معروف';
      const qty = item.quantity || 1;
      const price = item.price || 0;
      
      if (item.bundleItems && item.bundleItems.length > 0) {
        const bundleLines = item.bundleItems.map((bi: any, bIdx: number) => {
          let opts = [];
          if (bi.color) opts.push(bi.color);
          if (bi.size) opts.push(bi.size);
          return `      ${bIdx + 1}. ${opts.length > 0 ? opts.join(' / ') : '...'}`;
        }).join('\n');
        return `  ${idx + 1}. <b>${name}</b>\n      <b>Bundle: ${qty} Pieces</b>\n${bundleLines}\n      السعر: ${price} دج`;
      }
      
      const size = item.size || item.selectedSize;
      const color = item.color || item.selectedColor;
      
      let options = [];
      if (size) options.push(`مقاس: ${size}`);
      if (color) options.push(`لون: ${color}`);
      const optionsStr = options.length > 0 ? ` (${options.join(' - ')})` : '';
      
      return `  ${idx + 1}. <b>${name}</b>${optionsStr}\n      الكمية: ${qty} | السعر: ${price} دج`;
    }).join('\n\n');

    const total = orderData.totalPrice || 0;
    const dateStr = new Date().toLocaleString('ar-DZ', { timeZone: 'Africa/Algiers' });
    const orderNumValue = orderData.orderNumber || orderId;

    const deliveryType = orderData.deliveryType;
    let deliveryTypeText = '';
    if (deliveryType) {
      const dtLower = String(deliveryType).toLowerCase();
      if (dtLower.includes('home')) {
        deliveryTypeText = 'توصيل للمنزل';
      } else if (dtLower.includes('pickup') || dtLower.includes('desk') || dtLower.includes('office')) {
        deliveryTypeText = 'توصيل للمكتب / نقطة استلام';
      } else {
        deliveryTypeText = deliveryType;
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

    await sendTelegramMessage(botToken, chatId, messageText);
  } catch (err) {
    console.error('Failed to send Telegram notification:', err);
  }
};
