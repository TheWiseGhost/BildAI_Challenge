from flask import Flask, request, jsonify
from flask_cors import CORS
import tempfile
import os
import boto3
from werkzeug.utils import secure_filename
import logging
from dotenv import load_dotenv
import os

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)

load_dotenv()
ACCESS_KEY = os.environ.get('AWS_ACCESS_KEY')
SECRET_KEY = os.environ.get('AWS_SECRET_KEY')
REGION = os.environ.get('AWS_REGION')


try:
    textract = boto3.client(
        'textract',
        aws_access_key_id=ACCESS_KEY,
        aws_secret_access_key=SECRET_KEY,
        region_name=REGION
    )
except Exception as e:
    app.logger.error(f"Failed to initialize Textract client: {str(e)}")
    textract = None


def get_text(block_id, blocks_map):
    try:
        if block_id not in blocks_map:
            return ""
        
        block = blocks_map[block_id]
        if 'Text' in block:
            return block['Text']
        elif 'Relationships' in block:
            texts = []
            for rel in block['Relationships']:
                if rel['Type'] == 'CHILD':
                    if 'Ids' in rel:
                        for cid in rel['Ids']:
                            texts.append(get_text(cid, blocks_map))
                    elif 'Id' in rel:  # Fallback if single Id
                        texts.append(get_text(rel['Id'], blocks_map))
            return ' '.join(filter(None, texts))
        return ""
    except Exception as e:
        app.logger.error(f"Error extracting text for block {block_id}: {str(e)}")
        return ""


def extract_tables_from_image(image_path):
    try:
        if not textract:
            raise Exception("Textract client not initialized")
            
        # Validate file exists and is readable
        if not os.path.exists(image_path):
            raise Exception(f"Image file not found: {image_path}")
            
        # Check file size (Textract has limits)
        file_size = os.path.getsize(image_path)
        if file_size > 10 * 1024 * 1024:  # 10MB limit
            raise Exception("File too large. Maximum size is 10MB")
            
        with open(image_path, "rb") as document:
            image_bytes = document.read()

        app.logger.info(f"Sending {len(image_bytes)} bytes to Textract")

        # Call Textract for table extraction
        response = textract.analyze_document(
            Document={'Bytes': image_bytes},
            FeatureTypes=['TABLES']
        )

        if 'Blocks' not in response:
            raise Exception("No blocks found in Textract response")

        # Build a block map for easy lookup
        blocks_map = {block['Id']: block for block in response['Blocks']}
        
        # Extract tables
        table_blocks = [b for b in response['Blocks'] if b['BlockType'] == 'TABLE']
        
        if not table_blocks:
            app.logger.info("No tables found in the document")
            return []
            
        extracted_tables = []

        for table_idx, table in enumerate(table_blocks):
            app.logger.info(f"Processing table {table_idx + 1}")
            rows = {}
            
            for relationship in table.get('Relationships', []):
                if relationship['Type'] == 'CHILD':
                    for cell_id in relationship.get('Ids', []):
                        if cell_id not in blocks_map:
                            continue
                            
                        cell = blocks_map[cell_id]
                        if cell['BlockType'] == 'CELL':
                            row_index = cell['RowIndex']
                            col_index = cell['ColumnIndex']
                            text = get_text(cell_id, blocks_map).strip()
                            rows.setdefault(row_index, {})[col_index] = text

            if not rows:
                app.logger.warning(f"No rows found in table {table_idx + 1}")
                continue

           
            max_row = max(rows.keys()) if rows else 0
            table_data = []
            
            for row_idx in range(1, max_row + 1):
                if row_idx not in rows:
                    continue
                    
                row = rows[row_idx]
                max_col = max(row.keys()) if row else 0
                
                row_data = []
                for col_idx in range(1, max_col + 1):
                    row_data.append(row.get(col_idx, ""))
                
                if any(cell.strip() for cell in row_data):
                    table_data.append(row_data)
                
            if table_data:
                extracted_tables.append(table_data)
                app.logger.info(f"Extracted table {table_idx + 1} with {len(table_data)} rows")

        return extracted_tables

    except Exception as e:
        app.logger.error(f"Textract extraction failed: {str(e)}")
        raise e
    

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "textract_available": textract is not None})


@app.route('/extract-table', methods=['POST', 'OPTIONS'])
def extract_table():
    # Handle preflight CORS request
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        if 'image' not in request.files:
            return jsonify({"error": "No image provided"}), 400
            
        file = request.files['image']
        if file.filename == '':
            return jsonify({"error": "No selected file"}), 400

        # Validate file type
        allowed_extensions = {'.png', '.jpg', '.jpeg', '.pdf'}
        file_ext = os.path.splitext(file.filename)[1].lower()
        if file_ext not in allowed_extensions:
            return jsonify({"error": f"Unsupported file type: {file_ext}"}), 400

        # Create temp directory
        temp_dir = tempfile.mkdtemp()
        filename = secure_filename(file.filename)
        image_path = os.path.join(temp_dir, filename)
        
        app.logger.info(f"Processing file: {filename}")
        
        file.save(image_path)
        
        if not os.path.exists(image_path) or os.path.getsize(image_path) == 0:
            raise Exception("Failed to save uploaded file")
        
        tables = extract_tables_from_image(image_path)
        
        app.logger.info(f"Successfully extracted {len(tables)} tables")
        return jsonify({"tables": tables, "count": len(tables)})
        
    except Exception as e:
        app.logger.error(f"Error processing image: {str(e)}")
        return jsonify({"error": str(e)}), 500
        
    finally:
        try:
            if 'image_path' in locals() and os.path.exists(image_path):
                os.remove(image_path)
            if 'temp_dir' in locals() and os.path.exists(temp_dir):
                os.rmdir(temp_dir)
        except Exception as cleanup_error:
            app.logger.error(f"Cleanup error: {str(cleanup_error)}")


@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500


@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)