export class AuthUtils {
  /**
   * Kiểm tra xem input là email hay số điện thoại
   * @param input - string cần kiểm tra
   * @returns 'email' | 'phone'
   */
  static getInputType(input: string): 'email' | 'phone' {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const phoneRegex = /^(\+84|0)[0-9]{9,10}$/;

    if (emailRegex.test(input)) {
      return 'email';
    } else if (phoneRegex.test(input)) {
      return 'phone';
    }

    throw new Error('Input không phải email hoặc số điện thoại hợp lệ');
  }

  /**
   * Chuẩn hóa số điện thoại về format +84xxxxxxxxx
   * @param phone - số điện thoại cần chuẩn hóa
   * @returns số điện thoại đã chuẩn hóa
   */
  static normalizePhone(phone: string): string {
    const phoneRegex = /^(\+84|0)[0-9]{9,10}$/;

    if (!phoneRegex.test(phone)) {
      throw new Error('Số điện thoại không hợp lệ');
    }

    // Nếu bắt đầu bằng 0, thay thế bằng +84
    if (phone.startsWith('0')) {
      return '+84' + phone.substring(1);
    }
    // Nếu đã có +84, giữ nguyên
    return phone;
  }
}
