
from flask import Flask, jsonify, send_file, abort, render_template, send_from_directory, request
from flask_cors import CORS
import os
import shutil
from mimetypes import guess_type
from werkzeug.utils import secure_filename

app = Flask(__name__)

# CORS (frontend origin)
CORS(app, supports_credentials=True, origins=["http://localhost:8000"])

@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "http://localhost:8000"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS, DELETE"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

# Base directory for images
BASE_PATH = "/home/ubuntu/Capturesque/Images"

# Allowed image extensions for uploads & listing
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif"}


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/getJS/<fnam>')
def getpage(fnam):
    return send_from_directory('static', secure_filename(fnam))


@app.route('/api/images', methods=['GET'])
def get_folders():
    """
    Return top-level folders under BASE_PATH as {"folders": [...]}
    """
    try:
        folders = [folder for folder in os.listdir(BASE_PATH) if os.path.isdir(os.path.join(BASE_PATH, folder))]
        return jsonify({"folders": folders})
    except Exception as e:
        return jsonify({"error": f"Failed to fetch folders: {str(e)}"}), 500


@app.route('/api/images/<path:foldername>', methods=['GET'])
def get_all_images_recursive(foldername):
    """
    Return an array of image metadata (id, name, url, thumbnail, download)
    for all images under the requested folder (recursive).
    Frontend will apply non-recursive filtering if desired.
    """
    # foldername may be like "Gallery/Subfolder" (already separated by '/')
    safe_parts = [secure_filename(part) for part in foldername.replace('_', '/').split('/') if part != '']
    base_folder_path = os.path.join(BASE_PATH, *safe_parts) if safe_parts else BASE_PATH

    if not os.path.exists(base_folder_path) or not os.path.isdir(base_folder_path):
        return jsonify({"error": "Folder not found"}), 404

    try:
        images = []
        # Use request.url_root to build absolute URLs dynamically
        base_url = request.url_root.rstrip('/')

        for root, _, files in os.walk(base_folder_path):
            for file in files:
                if allowed_file(file):
                    abs_path = os.path.join(root, file)
                    rel_path = os.path.relpath(abs_path, BASE_PATH)
                    # rel_folder might be '' (file directly under BASE_PATH) or 'Gallery/Feature'
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
                        "id": filename,
                        "name": filename,
                        "url": image_url,
                        "thumbnail": image_url,
                        "download": download_url
                    })

        return jsonify(images), 200
    except Exception as e:
        return jsonify({"error": f"Failed to fetch images: {str(e)}"}), 500


@app.route('/api/folders/<path:parent_folder>', methods=['GET'])
def get_subfolders(parent_folder):
    """
    Return immediate subfolders of the given parent folder.
    """
    safe_parts = [secure_filename(part) for part in parent_folder.split('/') if part != '']
    folder_path = os.path.join(BASE_PATH, *safe_parts) if safe_parts else BASE_PATH

    if not os.path.exists(folder_path) or not os.path.isdir(folder_path):
        return jsonify({"error": "Folder not found"}), 404

    try:
        subfolders = [sf for sf in os.listdir(folder_path) if os.path.isdir(os.path.join(folder_path, sf))]
        return jsonify({"subfolders": subfolders})
    except Exception as e:
        return jsonify({"error": f"Failed to fetch subfolders: {str(e)}"}), 500


# Delete folder endpoint (recursive). Frontend may call DELETE /api/folders/<path>
@app.route('/api/folders/<path:foldername>', methods=['DELETE'])
def delete_folder(foldername):
    safe_parts = [secure_filename(part) for part in foldername.split('/') if part != '']
    folder_path = os.path.join(BASE_PATH, *safe_parts) if safe_parts else BASE_PATH

    # Safety checks: do not allow deleting the BASE_PATH root itself
    base_abs = os.path.abspath(BASE_PATH)
    target_abs = os.path.abspath(folder_path)

    if target_abs == base_abs:
        return jsonify({"error": "Cannot delete base directory"}), 400
    if not target_abs.startswith(base_abs + os.sep):
        return jsonify({"error": "Invalid folder path"}), 400
    if not os.path.exists(target_abs) or not os.path.isdir(target_abs):
        return jsonify({"error": "Folder not found"}), 404

    try:
        shutil.rmtree(target_abs)
        return jsonify({"message": "Folder deleted"}), 200
    except Exception as e:
        return jsonify({"error": f"Failed to delete folder: {str(e)}"}), 500


# Serve image (supports top-level images and nested folders)
@app.route('/api/image/<path:foldername>/<filename>', methods=['GET'])
def get_image(foldername, filename):
    safe_parts = [secure_filename(part) for part in foldername.split('/') if part != '']
    folder_path = os.path.join(BASE_PATH, *safe_parts) if safe_parts else BASE_PATH
    file_path = os.path.join(folder_path, secure_filename(filename))

    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        return jsonify({"error": "Image not found"}), 404

    try:
        mimetype, _ = guess_type(file_path)
        return send_file(file_path, mimetype=mimetype if mimetype else 'application/octet-stream')
    except Exception as e:
        return jsonify({"error": f"Failed to fetch image: {str(e)}"}), 500


@app.route('/api/image/<filename>', methods=['GET'])
def get_image_top(filename):
    """
    Serve images that are located directly under BASE_PATH (no folder).
    """
    file_path = os.path.join(BASE_PATH, secure_filename(filename))
    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        return jsonify({"error": "Image not found"}), 404
    try:
        mimetype, _ = guess_type(file_path)
        return send_file(file_path, mimetype=mimetype if mimetype else 'application/octet-stream')
    except Exception as e:
        return jsonify({"error": f"Failed to fetch image: {str(e)}"}), 500


# Download endpoints (attachment)
@app.route('/api/download/<path:foldername>/<filename>', methods=['GET'])
def download_image(foldername, filename):
    safe_parts = [secure_filename(part) for part in foldername.split('/') if part != '']
    folder_path = os.path.join(BASE_PATH, *safe_parts) if safe_parts else BASE_PATH
    file_path = os.path.join(folder_path, secure_filename(filename))

    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        return jsonify({"error": "Image not found"}), 404

    try:
        return send_file(file_path, as_attachment=True, conditional=True)
    except Exception as e:
        return jsonify({"error": f"Failed to download image: {str(e)}"}), 500


@app.route('/api/download/<filename>', methods=['GET'])
def download_image_top(filename):
    file_path = os.path.join(BASE_PATH, secure_filename(filename))
    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        return jsonify({"error": "Image not found"}), 404
    try:
        return send_file(file_path, as_attachment=True, conditional=True)
    except Exception as e:
        return jsonify({"error": f"Failed to download image: {str(e)}"}), 500


# Upload images to a folder or subfolder (expects form field name 'file' and supports multiple files)
@app.route('/api/upload/<path:foldername>', methods=['POST'])
def upload_image(foldername):
    safe_parts = [secure_filename(part) for part in foldername.split('/') if part != '']
    target_folder = os.path.join(BASE_PATH, *safe_parts) if safe_parts else BASE_PATH

    if not os.path.exists(target_folder) or not os.path.isdir(target_folder):
        return jsonify({"error": "Target folder does not exist"}), 404

    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400

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
            return jsonify({"error": "No valid image files uploaded", "skipped": skipped_files}), 400

        return jsonify({"message": "Files uploaded successfully", "files": saved_files, "skipped": skipped_files}), 201
    except Exception as e:
        return jsonify({"error": f"Failed to upload files: {str(e)}"}), 500


# Create new folder or nested subfolder
@app.route('/api/create-folder/<path:foldername>', methods=['POST'])
def create_folder(foldername):
    safe_parts = [secure_filename(part) for part in foldername.split('/') if part != '']
    new_folder_path = os.path.join(BASE_PATH, *safe_parts) if safe_parts else BASE_PATH

    try:
        os.makedirs(new_folder_path, exist_ok=False)
        return jsonify({"message": f"Folder '{foldername}' created successfully"}), 201
    except FileExistsError:
        return jsonify({"error": "Folder already exists"}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to create folder: {str(e)}"}), 500


# Delete file endpoint used by frontend: DELETE /api/delete/<folder>/<filename>
@app.route('/api/delete/<path:foldername>/<filename>', methods=['DELETE'])
def delete_image(foldername, filename):
    safe_parts = [secure_filename(part) for part in foldername.split('/') if part != '']
    folder_path = os.path.join(BASE_PATH, *safe_parts) if safe_parts else BASE_PATH
    file_path = os.path.join(folder_path, secure_filename(filename))

    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        return jsonify({"error": "Image not found"}), 404

    try:
        os.remove(file_path)
        return jsonify({"message": "Deleted"}), 200
    except Exception as e:
        return jsonify({"error": f"Failed to delete image: {str(e)}"}), 500


@app.route('/api/delete/<filename>', methods=['DELETE'])
def delete_image_top(filename):
    file_path = os.path.join(BASE_PATH, secure_filename(filename))
    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        return jsonify({"error": "Image not found"}), 404
    try:
        os.remove(file_path)
        return jsonify({"message": "Deleted"}), 200
    except Exception as e:
        return jsonify({"error": f"Failed to delete image: {str(e)}"}), 500


# Rename endpoint (expects JSON body: { folderId, oldName, newName })
@app.route('/api/rename', methods=['POST'])
def rename_file():
    data = request.get_json(force=True, silent=True) or {}
    folder_id = data.get('folderId', '')  # may be '' for base
    old_name = data.get('oldName')
    new_name = data.get('newName')

    if not old_name or not new_name:
        return jsonify({"error": "oldName and newName are required"}), 400

    # validate extensions
    if not allowed_file(old_name) or not allowed_file(new_name):
        return jsonify({"error": "Unsupported file extension"}), 400

    safe_parts = [secure_filename(part) for part in folder_id.split('/') if part != '']
    folder_path = os.path.join(BASE_PATH, *safe_parts) if safe_parts else BASE_PATH

    old_path = os.path.join(folder_path, secure_filename(old_name))
    new_path = os.path.join(folder_path, secure_filename(new_name))

    if not os.path.exists(old_path) or not os.path.isfile(old_path):
        return jsonify({"error": "Original file not found"}), 404

    if os.path.exists(new_path):
        return jsonify({"error": "A file with the new name already exists"}), 400

    try:
        os.rename(old_path, new_path)
        return jsonify({"message": "Renamed"}), 200
    except Exception as e:
        return jsonify({"error": f"Failed to rename file: {str(e)}"}), 500


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8087)

