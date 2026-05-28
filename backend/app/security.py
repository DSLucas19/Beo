import os
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import keyring

# Tên dịch vụ lưu trữ trong Keyring
KEYRING_SERVICE = "Beo"
KEYRING_USER = "master_key"

def _generate_fallback_key() -> bytes:
    """Tạo khóa mã hóa fallback từ biến môi trường hoặc chuỗi cố định"""
    master_secret = os.environ.get("BEO_MASTER_KEY", "beo_default_local_secret_key_12345!")
    salt = b"beo_salt_constant"
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(master_secret.encode()))
    return key

def get_encryption_key() -> bytes:
    """Lấy khóa mã hóa chủ từ Keyring hoặc fallback"""
    try:
        # Thử lấy khóa từ hệ thống keyring (Windows Credential Manager / macOS Keychain)
        key_str = keyring.get_password(KEYRING_SERVICE, KEYRING_USER)
        if key_str:
            return key_str.encode()
        else:
            # Nếu chưa có trong keyring, sinh khóa ngẫu nhiên mới và lưu lại
            new_key = Fernet.generate_key()
            try:
                keyring.set_password(KEYRING_SERVICE, KEYRING_USER, new_key.decode())
                return new_key
            except Exception:
                # Keyring có thể fail ở môi trường server headless không có GUI Keyring Service
                return _generate_fallback_key()
    except Exception:
        # Fallback hoàn toàn cho headless server/Docker
        return _generate_fallback_key()

def encrypt_key(plain_text: str) -> str:
    """Mã hóa API key/dữ liệu nhạy cảm thành chuỗi base64"""
    if not plain_text:
        return ""
    key = get_encryption_key()
    fernet = Fernet(key)
    encrypted_bytes = fernet.encrypt(plain_text.encode())
    return encrypted_bytes.decode()

def decrypt_key(encrypted_text: str) -> str:
    """Giải mã chuỗi base64 về API key/dữ liệu nhạy cảm ban đầu"""
    if not encrypted_text:
        return ""
    key = get_encryption_key()
    fernet = Fernet(key)
    try:
        decrypted_bytes = fernet.decrypt(encrypted_text.encode())
        return decrypted_bytes.decode()
    except Exception:
        raise ValueError("Không thể giải mã dữ liệu. Khóa mã hóa không khớp hoặc dữ liệu bị hỏng.")
