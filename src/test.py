from flask import Flask, jsonify, send_file, abort, request, send_from_directory
from flask_cors import CORS
import os
import shutil
from mimetypes import guess_type
from werkzeug.utils import secure_filename
from functools import wraps
from dotenv import load_dotenv
from flask_jwt_extended import JWTManager, jwt_required, get_jwt_identity

# Load env
load_dotenv()

app = Flask(__name__)

# Config - keep JWT secret in env so it matches auth.py when running separately
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "your-super-secret-key-that-is-very-long")
# Optional: control behavior via env
BASE_PATH = os.getenv("IMAGES_PATH", "/home/ubuntu/Capturesque/Images")
ALLOWED_EXTENSIONS = set(os.getenv("ALLOWED_EXTENSIONS", "png,jpg,jpeg,gif").split(","))

# CORS
CORS(app, supports_credentials=True)

# JWT
jwt = JWTManager(app)

# Helpers

def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def normalize_parts_from_path(path: str):
    """Split a path like 'Gallery/Sub' into safe parts (do not call secure_filename on the whole path)."""
    parts = [p for p in path.split('/') if p]
    return [secure_filename(p) for p in parts]


def safe_join_base(*parts):
    """Join BASE_PATH with provided (already secured) parts and ensure resulting path stays inside BASE_PATH."""
    candidate = os.path.join(BASE_PATH, *parts) if parts else BASE_PATH
    base_abs = os.path.abspath(BASE_PATH)
    target_abs = os.path.abspath(candidate)
    if not target_abs.startswith(base_abs + os.sep) and target_abs != base_abs:
        # path traversal or outside base
        raise ValueError("Invalid path")
    return candidate


def admin_required(fn):
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        # Allow preflight
        if request.method == 'OPTIONS':
            return jsonify({'status': 'ok'}), 200
        identity = get_jwt_identity() or {}
        if not (identity.get('is_admin') or identity.get('role') == 'admin'):
            return jsonify({'error': 'Admin access required'}), 403
        return fn(*args, **kwargs)
    return wrapper


# Routes


@app.route('/getJS/<fnam>')
def getpage(fnam):
    return send_from_directory('static', secure_filename(fnam))


@app.route('/api/images', methods=['GET'])
def get_folders():
    """Return top-level folders under BASE_PATH as { folders: [...] }"""
    try:
        folders = [f for f in os.listdir(BASE_PATH) if os.path.isdir(os.path.join(BASE_PATH, f))]
        return jsonify({'folders': folders})
    except Exception as e:
        return jsonify({'error': f'Failed to fetch folders: {str(e)}'}), 500


@app.route('/api/images/<path:foldername>', methods=['GET'])
def get_all_images_recursive(foldername):
    """
    Return an array of image metadata (id, name, url, thumbnail, download)
    for all images under the requested folder (recursive).
    """
    try:
        parts = normalize_parts_from_path(foldername)
        base_folder_path = safe_join_base(*parts)
    except ValueError:
        return jsonify({'error': 'Invalid folder path'}), 400

    if not os.path.exists(base_folder_path) or not os.path.isdir(base_folder_path):
        return jsonify({'error': 'Folder not found'}), 404

    try:
        images = []
        base_url = request.url_root.rstrip('/')
        for root, _, files in os.walk(base_folder_path):
            for file in files:
                if not allowed_file(file):
                    continue
                abs_path = os.path.join(root, file)
                rel_path = os.path.relpath(abs_path, BASE_PATH)
                rel_folder = os.path.dirname(rel_path).replace('\\', '/')
                rel_parts = [secure_filename(p) for p in rel_folder.split('/') if p]
                encoded_rel_folder = '/'.join(rel_parts)
                filename = secure_filename(file)

                if encoded_rel_folder:
                    image_url = f"{base_url}/api/image/{encoded_rel_folder}/{filename}"
                    download_url = f"{base_url}/api/download/{encoded_rel_folder}/{filename}"
                else:
                    image_url = f"{base_url}/api/image/{filename}"
                    download_url = f"{base_url}/api/download/{filename}"

                images.append({
                    'id': filename,
                    'name': filename,
                    'url': image_url,
                    'thumbnail': image_url,
                    'download': download_url,
                })
        return jsonify(images), 200
    except Exception as e:
        return jsonify({'error': f'Failed to fetch images: {str(e)}'}), 500


@app.route('/api/folders/<path:parent_folder>', methods=['GET'])
def get_subfolders(parent_folder):
    """Return immediate subfolders of the given parent folder."""
    try:
        parts = normalize_parts_from_path(parent_folder)
        folder_path = safe_join_base(*parts)
    except ValueError:
        return jsonify({'error': 'Invalid folder path'}), 400

    if not os.path.exists(folder_path) or not os.path.isdir(folder_path):
        return jsonify({'error': 'Folder not found'}), 404

    try:
        subfolders = [sf for sf in os.listdir(folder_path) if os.path.isdir(os.path.join(folder_path, sf))]
        return jsonify({'subfolders': subfolders})
    except Exception as e:
        return jsonify({'error': f'Failed to fetch subfolders: {str(e)}'}), 500


# Delete folder endpoint (recursive). Admin only
@app.route('/api/folders/<path:foldername>', methods=['DELETE', 'OPTIONS'])
@admin_required
def delete_folder(foldername):
    try:
        parts = normalize_parts_from_path(foldername)
        folder_path = safe_join_base(*parts)
    except ValueError:
        return jsonify({'error': 'Invalid folder path'}), 400

    base_abs = os.path.abspath(BASE_PATH)
    target_abs = os.path.abspath(folder_path)

    if target_abs == base_abs:
        return jsonify({'error': 'Cannot delete base directory'}), 400

    if not os.path.exists(target_abs) or not os.path.isdir(target_abs):
        return jsonify({'error': 'Folder not found'}), 404

    try:
        shutil.rmtree(target_abs)
        return jsonify({'message': 'Folder deleted'}), 200
    except Exception as e:
        return jsonify({'error': f'Failed to delete folder: {str(e)}'}), 500


# Serve image (public - view only)
@app.route('/api/image/<path:foldername>/<filename>', methods=['GET'])
def get_image(foldername, filename):
    try:
        parts = normalize_parts_from_path(foldername)
        folder_path = safe_join_base(*parts)
    except ValueError:
        return jsonify({'error': 'Invalid folder path'}), 400

    file_path = os.path.join(folder_path, secure_filename(filename))
    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        return jsonify({'error': 'Image not found'}), 404

    try:
        mimetype, _ = guess_type(file_path)
        return send_file(file_path, mimetype=mimetype or 'application/octet-stream')
    except Exception as e:
        return jsonify({'error': f'Failed to fetch image: {str(e)}'}), 500


@app.route('/api/image/<filename>', methods=['GET'])
def get_image_top(filename):
    file_path = os.path.join(BASE_PATH, secure_filename(filename))
    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        return jsonify({'error': 'Image not found'}), 404
    try:
        mimetype, _ = guess_type(file_path)
        return send_file(file_path, mimetype=mimetype or 'application/octet-stream')
    except Exception as e:
        return jsonify({'error': f'Failed to fetch image: {str(e)}'}), 500


# Download endpoints (attachment). Require login (jwt)
@app.route('/api/download/<path:foldername>/<filename>', methods=['GET'])
@jwt_required()
def download_image(foldername, filename):
    try:
        parts = normalize_parts_from_path(foldername)
        folder_path = safe_join_base(*parts)
    except ValueError:
        return jsonify({'error': 'Invalid folder path'}), 400

    file_path = os.path.join(folder_path, secure_filename(filename))
    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        return jsonify({'error': 'Image not found'}), 404

    try:
        return send_file(file_path, as_attachment=True, conditional=True)
    except Exception as e:
        return jsonify({'error': f'Failed to download image: {str(e)}'}), 500


@app.route('/api/download/<filename>', methods=['GET'])
@jwt_required()
def download_image_top(filename):
    file_path = os.path.join(BASE_PATH, secure_filename(filename))
    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        return jsonify({'error': 'Image not found'}), 404
    try:
        return send_file(file_path, as_attachment=True, conditional=True)
    except Exception as e:
        return jsonify({'error': f'Failed to download image: {str(e)}'}), 500


# Upload images to a folder or subfolder (expects form field name 'file' and supports multiple files) - Admin only
@app.route('/api/upload/<path:foldername>', methods=['POST', 'OPTIONS'])
@admin_required
def upload_image(foldername):
    try:
        parts = normalize_parts_from_path(foldername)
        target_folder = safe_join_base(*parts)
    except ValueError:
        return jsonify({'error': 'Invalid folder path'}), 400

    if not os.path.exists(target_folder) or not os.path.isdir(target_folder):
        return jsonify({'error': 'Target folder does not exist'}), 404

    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    files = request.files.getlist('file')
    saved_files = []
    skipped_files = []

    try:
        for file in files:
            if not file or file.filename == '':
                continue
            filename = secure_filename(file.filename)
            if not allowed_file(filename):
                skipped_files.append(filename)
                continue
            file_path = os.path.join(target_folder, filename)
            file.save(file_path)
            saved_files.append(filename)

        if not saved_files:
            return jsonify({'error': 'No valid image files uploaded', 'skipped': skipped_files}), 400

        return jsonify({'message': 'Files uploaded successfully', 'files': saved_files, 'skipped': skipped_files}), 201
    except Exception as e:
        return jsonify({'error': f'Failed to upload files: {str(e)}'}), 500


# Create new folder or nested subfolder - Admin only
@app.route('/api/create-folder/<path:foldername>', methods=['POST', 'OPTIONS'])
@admin_required
def create_folder(foldername):
    try:
        parts = normalize_parts_from_path(foldername)
        new_folder_path = safe_join_base(*parts)
    except ValueError:
        return jsonify({'error': 'Invalid folder path'}), 400

    try:
        os.makedirs(new_folder_path, exist_ok=False)
        return jsonify({'message': f"Folder '{foldername}' created successfully"}), 201
    except FileExistsError:
        return jsonify({'error': 'Folder already exists'}), 400
    except Exception as e:
        return jsonify({'error': f'Failed to create folder: {str(e)}'}), 500


# Delete file endpoint used by frontend: DELETE /api/delete/<folder>/<filename> - Admin only
@app.route('/api/delete/<path:foldername>/<filename>', methods=['DELETE', 'OPTIONS'])
@admin_required
def delete_image(foldername, filename):
    try:
        parts = normalize_parts_from_path(foldername)
        folder_path = safe_join_base(*parts)
    except ValueError:
        return jsonify({'error': 'Invalid folder path'}), 400

    file_path = os.path.join(folder_path, secure_filename(filename))
    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        return jsonify({'error': 'Image not found'}), 404

    try:
        os.remove(file_path)
        return jsonify({'message': 'Deleted'}), 200
    except Exception as e:
        return jsonify({'error': f'Failed to delete image: {str(e)}'}), 500


@app.route('/api/delete/<filename>', methods=['DELETE', 'OPTIONS'])
@admin_required
def delete_image_top(filename):
    file_path = os.path.join(BASE_PATH, secure_filename(filename))
    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        return jsonify({'error': 'Image not found'}), 404
    try:
        os.remove(file_path)
        return jsonify({'message': 'Deleted'}), 200
    except Exception as e:
        return jsonify({'error': f'Failed to delete image: {str(e)}'}), 500


# Rename endpoint for compatibility (JSON body) - Admin only
@app.route('/api/rename', methods=['POST', 'OPTIONS'])
@admin_required
def rename_file():
    data = request.get_json(force=True, silent=True) or {}
    folder_id = data.get('folderId', '')
    old_name = data.get('oldName')
    new_name = data.get('newName')

    if not old_name or not new_name:
        return jsonify({'error': 'oldName and newName are required'}), 400

    if not allowed_file(old_name) or not allowed_file(new_name):
        return jsonify({'error': 'Unsupported file extension'}), 400

    try:
        parts = normalize_parts_from_path(folder_id)
        folder_path = safe_join_base(*parts)
    except ValueError:
        return jsonify({'error': 'Invalid folder path'}), 400

    old_path = os.path.join(folder_path, secure_filename(old_name))
    new_path = os.path.join(folder_path, secure_filename(new_name))

    if not os.path.exists(old_path) or not os.path.isfile(old_path):
        return jsonify({'error': 'Original file not found'}), 404

    if os.path.exists(new_path):
        return jsonify({'error': 'A file with the new name already exists'}), 400

    try:
        os.rename(old_path, new_path)
        return jsonify({'message': 'Renamed'}), 200
    except Exception as e:
        return jsonify({'error': f'Failed to rename file: {str(e)}'}), 500


# Rename folder endpoint (Admin only) - expects JSON { newName }
@app.route('/api/rename-folder/<path:foldername>', methods=['POST', 'OPTIONS'])
@admin_required
def rename_folder(foldername):
    data = request.get_json(force=True, silent=True) or {}
    new_name = data.get('newName')
    if not new_name or new_name.strip() == '':
        return jsonify({'error': 'newName required'}), 400

    try:
        parts = normalize_parts_from_path(foldername)
        if not parts:
            return jsonify({'error': 'Invalid folder'}), 400
        parent_parts = parts[:-1]
        old_folder_path = safe_join_base(*parts)
        new_folder_path = safe_join_base(*parent_parts, secure_filename(new_name))
    except ValueError:
        return jsonify({'error': 'Invalid folder path'}), 400

    if not os.path.exists(old_folder_path) or not os.path.isdir(old_folder_path):
        return jsonify({'error': 'Folder not found'}), 404
    if os.path.exists(new_folder_path):
        return jsonify({'error': 'Target folder name already exists'}), 400

    try:
        os.rename(old_folder_path, new_folder_path)
        return jsonify({'message': 'Folder renamed'}), 200
    except Exception as e:
        return jsonify({'error': f'Failed to rename folder: {str(e)}'}), 500


# Rename image endpoint (Admin only) - POST /api/rename-image/<path:foldername>/<oldName> { newName }
@app.route('/api/rename-image/<path:foldername>/<old_name>', methods=['POST', 'OPTIONS'])
@admin_required
def rename_image(foldername, old_name):
    data = request.get_json(force=True, silent=True) or {}
    new_name = data.get('newName')
    if not new_name or new_name.strip() == '':
        return jsonify({'error': 'newName required'}), 400

    if not allowed_file(old_name) or not allowed_file(new_name):
        return jsonify({'error': 'Unsupported file extension'}), 400

    try:
        parts = normalize_parts_from_path(foldername)
        folder_path = safe_join_base(*parts)
    except ValueError:
        return jsonify({'error': 'Invalid folder path'}), 400

    old_path = os.path.join(folder_path, secure_filename(old_name))
    new_path = os.path.join(folder_path, secure_filename(new_name))

    if not os.path.exists(old_path) or not os.path.isfile(old_path):
        return jsonify({'error': 'Original file not found'}), 404
    if os.path.exists(new_path):
        return jsonify({'error': 'A file with the new name already exists'}), 400

    try:
        os.rename(old_path, new_path)
        return jsonify({'message': 'Image renamed'}), 200
    except Exception as e:
        return jsonify({'error': f'Failed to rename image: {str(e)}'}), 500


if __name__ == '__main__':
    port = int(os.getenv('PORT', '5000'))
    debug = os.getenv('FLASK_DEBUG', 'true').lower() in ('1', 'true', 'yes')
    if not os.path.exists(BASE_PATH):
        # create base path for convenience in dev
        try:
            os.makedirs(BASE_PATH, exist_ok=True)
        except Exception:
            pass
    app.run(debug=debug, host='0.0.0.0', port='8087')
