import { format } from 'date-fns';

export async function compressImage(file: File, maxWidth = 1600, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ratio = Math.min(maxWidth / img.width, 1);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl.split(',')[1]);
        } else {
          reject(new Error("Canvas context failed"));
        }
      };
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

export async function checkOcrConfig() {
  const workerUrl = localStorage.getItem('cf_worker_url');
  return !!workerUrl;
}

export async function callBaiduOCR(base64Image: string) {
  const workerUrl = localStorage.getItem('cf_worker_url');
  const accessToken = localStorage.getItem('ocr_access_token');

  if (!workerUrl) {
    throw new Error('未配置 OCR Worker URL，请前往设置页配置');
  }

  const ocrResp = await fetch(workerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({
      action: 'ocr',
      image: base64Image,
    })
  });

  if (!ocrResp.ok) throw new Error(`OCR请求失败: ${ocrResp.status}`);

  const ocrData = await ocrResp.json();
  if (ocrData.error_code) {
    throw new Error(`识别失败[${ocrData.error_code}]: ${ocrData.error_msg}`);
  }
  return ocrData;
}

export function parseOCRData(wordsResult: any[], existingResult: any = null) {
  const lines = wordsResult.map((w: any) => w.words);
  const allText = lines.join(' ');
  
  const result: any = existingResult?.data ? { ...existingResult.data } : {
    date: null,
    fuelLiters: null,
    unitPrice: null,
    totalCost: null,
    fuelType: null,
    dashboardFuelPer100: null,
    dashboardAvgSpeed: null,
    dashboardDriveHours: null,
    drivenKm: null,
    dashboardRange: null,
    dashboardOdo: null
  };
  const confidence: any = existingResult?.confidence ? { ...existingResult.confidence } : {
    date: null,
    fuelLiters: null,
    unitPrice: null,
    totalCost: null,
    fuelType: null,
    dashboardFuelPer100: null,
    dashboardAvgSpeed: null,
    dashboardDriveHours: null,
    drivenKm: null,
    dashboardRange: null,
    dashboardOdo: null,
    crossCheck: false
  };

  // ① 加油日期 (YYYY-MM-DD)
  if (!result.date) {
    const datePatterns = [
      /(?:加油|收款|交易)时间[：:\s]*(\d{4}[-\/]\d{2}[-\/]\d{2})/,
      /(\d{4}[-\/]\d{2}[-\/]\d{2})/
    ];
    for (let i = 0; i < datePatterns.length; i++) {
      for (const line of lines) {
        const match = line.match(datePatterns[i]);
        if (match) {
          result.date = match[1].replace(/\//g, '-');
          confidence.date = i === 0 ? 'high' : 'low';
          break;
        }
      }
      if (result.date) break;
    }
  }

  // ② 加油量
  if (!result.fuelLiters) {
    const literPatterns = [
      /数\s*量[：:\s]*([\d.]+)\s*[Ll升]/i,
      /数量合计[：:\s]*([\d.]+)\s*[Ll升]/i,
      /([\d.]+)\s*[Ll升]\b/i
    ];
    for (let i = 0; i < literPatterns.length; i++) {
      for (const line of lines) {
        const match = line.match(literPatterns[i]);
        if (match) {
          result.fuelLiters = parseFloat(match[1]);
          confidence.fuelLiters = i === 0 ? 'high' : 'low';
          break;
        }
      }
      if (result.fuelLiters) break;
    }
  }

  // ③ 单价
  if (!result.unitPrice) {
    const pricePatterns = [
      /单\s*价[：:\s]*[¥￥]?\s*([\d.]+)/,
      /[¥￥]([\d.]+)\/[Ll]/i,
      /单价\s*([\d.]+)/
    ];
    for (let i = 0; i < pricePatterns.length; i++) {
      for (const line of lines) {
        const match = line.match(pricePatterns[i]);
        if (match) {
          result.unitPrice = parseFloat(match[1]);
          confidence.unitPrice = i === 0 ? 'high' : 'low';
          break;
        }
      }
      if (result.unitPrice) break;
    }
  }

  // ④ 总价
  if (!result.totalCost) {
    const totalPatterns = [
      /实付金额[：:\s]*[¥￥]?\s*([\d.]+)/,
      /油品合计[：:\s]*[¥￥]?\s*([\d.]+)/,
      /商品金额[：:\s]*[¥￥]?\s*([\d.]+)/,
      /总金额[：:\s]*[¥￥]?\s*([\d.]+)/,
      /金额[：:\s]*[¥￥]?\s*([\d.]+)/,
      /合计[：:\s]*[¥￥]?\s*([\d.]+)/
    ];
    for (let i = 0; i < totalPatterns.length; i++) {
      for (const line of lines) {
        const match = line.match(totalPatterns[i]);
        if (match) {
          result.totalCost = parseFloat(match[1]);
          confidence.totalCost = i === 0 ? 'high' : 'low';
          break;
        }
      }
      if (result.totalCost) break;
    }
  }

  // ⑤ 油品型号
  if (!result.fuelType) {
    const fuelTypePatterns = [
      /油\s*号[：:\s]*(汽\d+|柴\d+|[A-Z0-9]+)/,
      /(92|95|98|0)号?车?用?汽柴?油/,
      /汽油(\d+)/
    ];
    for (let i = 0; i < fuelTypePatterns.length; i++) {
      for (const line of lines) {
        const match = line.match(fuelTypePatterns[i]);
        if (match) {
          result.fuelType = match[1];
          confidence.fuelType = 'low';
          break;
        }
      }
      if (result.fuelType) break;
    }
  }

  // === 仪表盘解析 ===
  const isDashboardImage = lines.some((l: string) => /km|100km|rpm|里程|上次|启动|h|续航/i.test(l));
  const isSinceRefuel = lines.some((l: string) => /上次|加油后/i.test(l));

  if (isDashboardImage) {
    // 表显油耗 (e.g., 5.2 l/100km, 5.21/100km, 6.1 L/100)
    // 很多时候 OCR 会把 l 识别成 1 或者 I
    for (const line of lines) {
      if (!result.dashboardFuelPer100 || confidence.dashboardFuelPer100 !== 'high') {
        const match = line.match(/([0-9.]+)\s*(?:[l1iI|升]\s*)?\/[1lI]00/i) || line.match(/([0-9.]+)\s*[l1iI升|][\s/]?100/i);
        if (match) {
          result.dashboardFuelPer100 = parseFloat(match[1]);
          confidence.dashboardFuelPer100 = isSinceRefuel ? 'high' : 'low';
        }
      }
    }
    
    // 平均车速 (e.g., 32 km/h, 23km/h, 32 km / h)
    for (const line of lines) {
      if (!result.dashboardAvgSpeed || confidence.dashboardAvgSpeed !== 'high') {
        const match = line.match(/(?:[øØo0]\s*)?([0-9.]+)\s*k[mn]\s*\/\s*h/i);
        if (match) {
          result.dashboardAvgSpeed = parseFloat(match[1]);
          confidence.dashboardAvgSpeed = isSinceRefuel ? 'high' : 'low';
        }
      }
    }

    if (isSinceRefuel && (!result.dashboardAvgSpeed || confidence.dashboardAvgSpeed !== 'high')) {
      const sinceRefuelSpeed = allText.match(/(?:自上次加油后|上次|加油后)[\s\S]{0,80}?(?:[øØo0]\s*)?([0-9]{1,3}(?:\.[0-9]+)?)\s*k[mn]\s*\/\s*h/i)
        || allText.match(/(?:[øØo0]\s*)?([0-9]{1,3}(?:\.[0-9]+)?)\s*k[mn]\s*\/\s*h/i);
      if (sinceRefuelSpeed) {
        result.dashboardAvgSpeed = parseFloat(sinceRefuelSpeed[1]);
        confidence.dashboardAvgSpeed = 'high';
      }
    }

    // 行驶时间 (e.g., 24:23 h, 0:45h)
    for (const line of lines) {
      if (!result.dashboardDriveHours || confidence.dashboardDriveHours !== 'high') {
        const match = line.match(/(\d{1,3}[:：]\d{2})(?:\s*h\b)?/i);
        // Only accept if it has 'h' OR looks exactly like time. Wait, standalone hh:mm might be a clock.
        // If it's a clock (e.g. 8:26) we don't want it. Clock usually matched along with Date or is standalone.
        // Let's require 'h' or '小时' at the end or if the first digit > 24 it's definitely hours.
        if (match && (line.toLowerCase().includes('h') || line.includes('小时') || parseInt(match[1]) > 24)) {
            result.dashboardDriveHours = match[1].replace('：', ':');
            confidence.dashboardDriveHours = isSinceRefuel ? 'high' : 'low';
        }
      }
    }
    
    // 里程和续航
    const kmEntries: { value: number; line: string }[] = [];
    for (const line of lines) {
      // 过滤掉包含 /100, /h 的油耗和速度数据
      if (/\/(100|h|n)/i.test(line) || /100\s*k/i.test(line) || line.toLowerCase().includes('rpm')) continue;
      const match = line.match(/([0-9.]+)\s*k[rn|m]/i);
      if (match) {
        kmEntries.push({ value: parseFloat(match[1]), line });
      }
    }
    
    kmEntries.sort((a, b) => b.value - a.value); // 降序: 最大的可能是 ODO，其次可能是加油后行驶里程/剩余续航
    
    if (kmEntries.length > 0) {
      const odoCandidate = kmEntries.find(entry => entry.value > 5000); // 一般总里程大于5000
      if (odoCandidate) {
        result.dashboardOdo = odoCandidate.value;
        confidence.dashboardOdo = 'high';
        kmEntries.splice(kmEntries.indexOf(odoCandidate), 1);
      } else if (kmEntries[0].value > 2000 && !result.dashboardOdo) {
        result.dashboardOdo = kmEntries[0].value;
        confidence.dashboardOdo = 'low';
        kmEntries.shift();
      }
    }
    
    if (kmEntries.length > 0) {
        // 只有明确出现“上次/加油后”语义时，才自动填行驶里程，避免把剩余续航误当成行驶里程。
        if (isSinceRefuel && (!result.drivenKm || confidence.drivenKm !== 'high')) {
            const drivenCandidate = kmEntries.find(entry => entry.value > 5 && entry.value < 2000); 
            if (drivenCandidate) {
                result.drivenKm = drivenCandidate.value;
                confidence.drivenKm = 'high';
                kmEntries.splice(kmEntries.indexOf(drivenCandidate), 1);
            }
        }
    }
    
    if (kmEntries.length > 0) {
        // “自启动/启动起”的 29km 这类短途里程不是剩余续航；多个候选时优先取更像续航的较大值。
        const nonTripEntries = kmEntries.filter(entry => !/(自启动|启动起|启动后|trip)/i.test(entry.line));
        const rangePool = (nonTripEntries.length > 0 ? nonTripEntries : kmEntries)
            .map(entry => entry.value)
            .filter(value => value >= 10 && value <= 1500);
        const rangeCandidate = rangePool.length > 1 ? Math.max(...rangePool) : rangePool[0];
        if (!result.dashboardRange || rangeCandidate < (result.dashboardRange||9999)) {
            result.dashboardRange = rangeCandidate;
            confidence.dashboardRange = nonTripEntries.length > 0 ? 'high' : 'low';
        }
    }
  }

  // 交叉验证
  if (result.fuelLiters && result.unitPrice && result.totalCost) {
    const calc = result.fuelLiters * result.unitPrice;
    if (Math.abs(calc - result.totalCost) < 1.0) {
      confidence.crossCheck = true;
    } else {
      confidence.crossCheck = false;
    }
  }

  return { fields: result, confidence };
}
