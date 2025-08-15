"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Upload,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Table2,
  Maximize2,
  MapIcon,
} from "lucide-react";

const PDFCaptureTool = () => {
  const [pdfPages, setPdfPages] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [zoom, setZoom] = useState(0.8);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selections, setSelections] = useState([]);
  const [currentSelection, setCurrentSelection] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [capturedImages, setCapturedImages] = useState([]);
  const [extractingStates, setExtractingStates] = useState({});
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [showCaptures, setShowCaptures] = useState(false);

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const containerRef = useRef(null);
  const miniMapRef = useRef(null);

  useEffect(() => {
    const loadPdfJs = async () => {
      if (typeof window !== "undefined" && !window.pdfjsLib) {
        try {
          const script = document.createElement("script");
          script.src =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
          script.async = true;

          script.onload = () => {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
              "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
          };

          document.head.appendChild(script);
        } catch (error) {
          console.error("Failed to load PDF.js:", error);
        }
      }
    };

    loadPdfJs();
  }, []);

  const renderPDFPage = async (pdf, pageNumber, canvas) => {
    try {
      const page = await pdf.getPage(pageNumber + 1);
      const viewport = page.getViewport({ scale: 10.0 });

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const context = canvas.getContext("2d");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;

      return {
        width: viewport.width / 2,
        height: viewport.height / 2,
        canvas: canvas,
        originalWidth: viewport.width,
        originalHeight: viewport.height,
      };
    } catch (error) {
      console.error("Error rendering PDF page:", error);
      throw error;
    }
  };

  const processPDF = async (file) => {
    setIsLoadingPdf(true);

    try {
      if (!window.pdfjsLib) {
        throw new Error("PDF.js not loaded yet");
      }

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer })
        .promise;

      setTotalPages(pdf.numPages);

      const pages = [];
      for (let i = 0; i < pdf.numPages; i++) {
        const canvas = document.createElement("canvas");
        const pageInfo = await renderPDFPage(pdf, i, canvas);

        pages.push({
          pageNumber: i,
          width: pageInfo.width,
          height: pageInfo.height,
          canvas: pageInfo.canvas,
          originalWidth: pageInfo.originalWidth,
          originalHeight: pageInfo.originalHeight,
          imageData: pageInfo.canvas.toDataURL("image/png", 1.0),
        });
      }

      setPdfPages(pages);
      setCurrentPage(0);
    } catch (error) {
      console.error("Error processing PDF:", error);
      alert("Error loading PDF: " + error.message);
    } finally {
      setIsLoadingPdf(false);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type === "application/pdf") {
      processPDF(file);
      setSelections([]);
      setCapturedImages([]);
      setCurrentPage(0);
    } else {
      alert("Please select a valid PDF file");
    }
  };

  const handleMouseDown = (event) => {
    if (!pdfPages.length) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / zoom;
    const y = (event.clientY - rect.top) / zoom;

    setIsSelecting(true);
    setCurrentSelection({
      startX: x,
      startY: y,
      endX: x,
      endY: y,
      page: currentPage,
    });
  };

  const handleMouseMove = (event) => {
    if (!isSelecting || !currentSelection) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / zoom;
    const y = (event.clientY - rect.top) / zoom;

    setCurrentSelection((prev) => ({
      ...prev,
      endX: x,
      endY: y,
    }));
  };

  const handleMouseUp = () => {
    if (currentSelection && isSelecting) {
      const selection = {
        ...currentSelection,
        id: Date.now() + Math.random(),
        width: Math.abs(currentSelection.endX - currentSelection.startX),
        height: Math.abs(currentSelection.endY - currentSelection.startY),
      };

      if (selection.width > 10 && selection.height > 10) {
        setSelections((prev) => [...prev, selection]);
      }
    }

    setIsSelecting(false);
    setCurrentSelection(null);
  };

  const handleMiniMapClick = (e) => {
    if (!containerRef.current || !miniMapRef.current || !pdfPages[currentPage])
      return;

    const miniMapRect = miniMapRef.current.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    const clickX = e.clientX - miniMapRect.left;
    const clickY = e.clientY - miniMapRect.top;

    const percentX = clickX / miniMapRect.width;
    const percentY = clickY / miniMapRect.height;

    const pdfWidth = pdfPages[currentPage].width * zoom;
    const pdfHeight = pdfPages[currentPage].height * zoom;

    const targetX = Math.max(0, percentX * pdfWidth - containerRect.width / 2);
    const targetY = Math.max(
      0,
      percentY * pdfHeight - containerRect.height / 2
    );

    containerRef.current.scrollTo({
      left: targetX,
      top: targetY,
      behavior: "smooth",
    });
  };

  const renderSelections = () => {
    return selections
      .filter((sel) => sel.page === currentPage)
      .map((selection) => {
        const x = Math.min(selection.startX, selection.endX);
        const y = Math.min(selection.startY, selection.endY);
        const width = Math.abs(selection.endX - selection.startX);
        const height = Math.abs(selection.endY - selection.startY);

        return (
          <div
            key={selection.id}
            className="absolute border-2 border-blue-500 bg-none bg-opacity-10 cursor-pointer group"
            style={{
              left: x * zoom,
              top: y * zoom,
              width: width * zoom,
              height: height * zoom,
            }}
            onClick={(e) => {
              e.stopPropagation();
              removeSelection(selection.id);
            }}
          >
            <div className="absolute -top-6 left-0 bg-blue-500 text-white px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity">
              Area {selections.indexOf(selection) + 1} (Click to remove)
            </div>
          </div>
        );
      });
  };

  const renderCurrentSelection = () => {
    if (!currentSelection || !isSelecting) return null;

    const x = Math.min(currentSelection.startX, currentSelection.endX);
    const y = Math.min(currentSelection.startY, currentSelection.endY);
    const width = Math.abs(currentSelection.endX - currentSelection.startX);
    const height = Math.abs(currentSelection.endY - currentSelection.startY);

    return (
      <div
        className="absolute border-2 border-red-500 bg-none bg-opacity-20 pointer-events-none"
        style={{
          left: x * zoom,
          top: y * zoom,
          width: width * zoom,
          height: height * zoom,
        }}
      />
    );
  };

  const removeSelection = (id) => {
    setSelections((prev) => prev.filter((sel) => sel.id !== id));
  };

  const clearAllSelections = () => {
    setSelections([]);
  };

  const captureSelections = () => {
    if (!selections.length) {
      alert("Please select at least one area");
      return;
    }

    setIsProcessing(true);

    const newCaptures = selections
      .map((selection) => {
        const page = pdfPages[selection.page];
        if (!page) return null;

        const x = Math.min(selection.startX, selection.endX);
        const y = Math.min(selection.startY, selection.endY);
        const width = Math.abs(selection.endX - selection.startX);
        const height = Math.abs(selection.endY - selection.startY);

        const scaleX = page.originalWidth / page.width;
        const scaleY = page.originalHeight / page.height;

        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = width * scaleX;
        tempCanvas.height = height * scaleY;

        const ctx = tempCanvas.getContext("2d");

        ctx.drawImage(
          page.canvas,
          x * scaleX,
          y * scaleY,
          width * scaleX,
          height * scaleY,
          0,
          0,
          width * scaleX,
          height * scaleY
        );

        return {
          id: Date.now() + Math.random(),
          imageData: tempCanvas.toDataURL("image/png", 1.0),
          page: selection.page,
          coords: { x, y, width, height },
        };
      })
      .filter(Boolean);

    setCapturedImages((prev) => [...prev, ...newCaptures]);
    setIsProcessing(false);
  };

  const downloadImage = (imageData, index) => {
    const link = document.createElement("a");
    link.href = imageData;
    link.download = `capture_${index + 1}.png`;
    link.click();
  };

  const downloadAllImages = () => {
    capturedImages.forEach((img, index) => {
      const link = document.createElement("a");
      link.href = img.imageData;
      link.download = `capture_${index + 1}.png`;
      link.click();
    });
  };

  const clearAllCaptures = () => {
    setCapturedImages([]);
    setExtractingStates({});
  };

  const extractTableFromImage = async (imageData, captureId) => {
    setExtractingStates((prev) => ({ ...prev, [captureId]: true }));

    try {
      const response = await fetch(imageData);
      const blob = await response.blob();

      const formData = new FormData();
      formData.append("image", blob, `capture_${captureId}.png`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const ocrResponse = await fetch("http://localhost:5000/extract-table", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!ocrResponse.ok) {
        throw new Error(`Server responded with ${ocrResponse.status}`);
      }

      const result = await ocrResponse.json();

      if (result.error) {
        throw new Error(result.error);
      }

      if (!result.tables || result.tables.length === 0) {
        throw new Error("No tables found in the image");
      }

      let csvContent = "";
      result.tables.forEach((table, tableIndex) => {
        csvContent += `Table ${tableIndex + 1}\n`;
        table.forEach((row) => {
          const escapedRow = row.map((cell) => {
            if (
              typeof cell === "string" &&
              (cell.includes(",") || cell.includes("\n") || cell.includes('"'))
            ) {
              return `"${cell.replace(/"/g, '""')}"`;
            }
            return cell;
          });
          csvContent += escapedRow.join(",") + "\n";
        });
        csvContent += "\n";
      });

      const blob2 = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob2);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `table_${captureId}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Extraction failed:", error);
      alert(`Table extraction failed: ${error.message}`);
    } finally {
      setExtractingStates((prev) => ({ ...prev, [captureId]: false }));
    }
  };

  return (
    <div
      className="min-h-screen bg-gray-50 p-4"
      style={{ fontFamily: "Inter, sans-serif" }}
    >
      <div className="w-full px-0 mx-auto">
        <div className="flex items-center justify-between mb-4 bg-white rounded-lg shadow-sm p-3">
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              ref={fileInputRef}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current.click()}
              className="flex items-center gap-1 bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 transition-colors"
              title="Upload PDF"
            >
              <Upload size={18} />
              <span className="ml-1 text-sm">Upload</span>
            </button>

            {pdfPages.length > 0 && (
              <>
                <div className="flex gap-1">
                  <button
                    onClick={() => setZoom((prev) => Math.max(0.5, prev - 0.1))}
                    className="p-2 text-gray-800 rounded hover:bg-gray-200 transition-colors"
                    title="Zoom Out"
                  >
                    <ZoomOut size={18} />
                  </button>
                  <button
                    onClick={() => setZoom(1)}
                    className="p-2 text-gray-800 rounded hover:bg-gray-200 transition-colors"
                    title="Reset Zoom"
                  >
                    <RotateCcw size={18} />
                  </button>
                  <button
                    onClick={() => setZoom((prev) => Math.min(3, prev + 0.1))}
                    className="p-2 text-gray-800 rounded hover:bg-gray-200 transition-colors"
                    title="Zoom In"
                  >
                    <ZoomIn size={18} />
                  </button>
                  <button
                    onClick={() => setShowMiniMap((prev) => !prev)}
                    className="p-2 text-gray-800 rounded hover:bg-gray-200 transition-colors"
                    title="Toggle Map"
                  >
                    <MapIcon size={18} />
                  </button>
                </div>

                <div className="flex gap-1">
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(0, prev - 1))
                    }
                    disabled={currentPage === 0}
                    className="p-2 rounded text-gray-800 hover:bg-gray-200 transition-colors"
                    title="Previous Page"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={() =>
                      setCurrentPage((prev) =>
                        Math.min(totalPages - 1, prev + 1)
                      )
                    }
                    disabled={currentPage === totalPages - 1}
                    className="p-2 rounded text-gray-800 hover:bg-gray-200 transition-colors"
                    title="Next Page"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>

                <div className="flex gap-1">
                  <button
                    onClick={clearAllSelections}
                    disabled={selections.length === 0}
                    className="p-2 rounded text-gray-800 hover:bg-gray-200 transition-colors"
                    title="Clear Selections"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </>
            )}
          </div>

          {pdfPages.length > 0 && (
            <div className="flex items-center gap-2">
              {pdfPages.length > 0 && capturedImages.length > 0 && (
                <button
                  onClick={() => setShowCaptures(!showCaptures)}
                  className={`flex items-center gap-2 px-3 py-2 rounded ${
                    showCaptures
                      ? "bg-blue-500 text-white hover:bg-blue-600"
                      : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                  } transition-colors`}
                  title={showCaptures ? "Back to PDF" : "View Captures"}
                >
                  <span className="text-sm">
                    {showCaptures
                      ? "Back to PDF"
                      : `See Captures (${capturedImages.length})`}
                  </span>
                </button>
              )}
              {pdfPages.length > 0 &&
                capturedImages.length == 0 &&
                showCaptures && (
                  <button
                    onClick={() => setShowCaptures(false)}
                    className={`flex items-center gap-2 px-3 py-2 rounded ${
                      showCaptures
                        ? "bg-blue-500 text-white hover:bg-blue-600"
                        : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                    } transition-colors`}
                    title={"Back to PDF"}
                  >
                    <span className="text-sm">Back to PDF</span>
                  </button>
                )}
              <button
                onClick={captureSelections}
                disabled={isProcessing || selections.length === 0}
                className={`flex items-center gap-2 px-3 py-2 rounded ${
                  selections.length > 0
                    ? "bg-green-500 text-white hover:bg-green-600"
                    : "bg-gray-200 text-gray-500 cursor-not-allowed"
                } transition-colors`}
                title="Capture Selected Areas"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span className="text-sm">Capturing...</span>
                  </>
                ) : (
                  <span className="text-sm">Capture ({selections.length})</span>
                )}
              </button>
            </div>
          )}
        </div>

        {!pdfPages.length && !isLoadingPdf && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center mb-6">
            <Upload size={64} className="mx-auto mb-6 text-blue-500" />
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Upload a PDF to Get Started
            </h2>
            <p className="text-gray-600 mb-6">
              Click the "Upload" button above to select a PDF file
            </p>
            <button
              onClick={() => fileInputRef.current.click()}
              className="flex items-center gap-2 bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors mx-auto"
            >
              <Upload size={20} />
              Select PDF File
            </button>
          </div>
        )}

        {!showCaptures && pdfPages.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-2 mb-6 relative">
            <div
              ref={containerRef}
              className="border rounded-lg overflow-auto bg-white relative"
              style={{ maxHeight: "700px" }}
            >
              {isLoadingPdf ? (
                <div className="flex items-center justify-center h-96">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading PDF...</p>
                  </div>
                </div>
              ) : pdfPages.length > 0 && pdfPages[currentPage] ? (
                <div
                  ref={canvasRef}
                  className="relative cursor-crosshair bg-white mx-auto"
                  style={{
                    width: pdfPages[currentPage].width * zoom,
                    height: pdfPages[currentPage].height * zoom,
                    backgroundImage: `url(${pdfPages[currentPage].imageData})`,
                    backgroundSize: "100% 100%",
                    backgroundRepeat: "no-repeat",
                    minWidth: "fit-content",
                  }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                >
                  {renderSelections()}
                  {renderCurrentSelection()}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {showCaptures && capturedImages.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                Captured Images ({capturedImages.length})
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={downloadAllImages}
                  className="flex items-center gap-1 bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 text-sm"
                  title="Download All"
                >
                  <Download size={16} />
                </button>
                <button
                  onClick={clearAllCaptures}
                  className="flex items-center gap-1 bg-red-500 text-white px-3 py-2 rounded hover:bg-red-600 text-sm"
                  title="Clear All"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {capturedImages.map((capture, index) => (
                <div
                  key={capture.id}
                  className="border rounded-lg overflow-hidden bg-gray-50 transition-transform hover:scale-[1.02]"
                >
                  <div className="p-2 bg-gray-100 text-sm font-medium flex justify-between items-center">
                    <span>Capture {index + 1}</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => downloadImage(capture.imageData, index)}
                        className="text-blue-500 hover:text-blue-700 flex items-center gap-1"
                        title="Download"
                      >
                        <Download size={16} />
                      </button>
                      <button
                        onClick={() =>
                          extractTableFromImage(capture.imageData, capture.id)
                        }
                        className={`flex items-center gap-1 ${"text-purple-500 hover:text-purple-700"}`}
                        title="Extract Table"
                      >
                        <Table2 size={16} />
                      </button>
                    </div>
                  </div>
                  <img
                    src={capture.imageData}
                    alt={`Captured area ${index + 1}`}
                    className="w-full h-auto object-contain max-h-64 bg-white"
                  />
                  <div className="p-2 text-xs text-gray-500 bg-gray-100">
                    <div>Page: {capture.page + 1}</div>
                    <div>
                      Position: {Math.round(capture.coords.x)}px ×{" "}
                      {Math.round(capture.coords.y)}px
                    </div>
                    <div>
                      Size: {Math.round(capture.coords.width)}px ×{" "}
                      {Math.round(capture.coords.height)}px
                    </div>
                  </div>

                  {/* Extraction status */}
                  {extractingStates[capture.id] && (
                    <div className="p-2 text-center text-xs text-gray-500">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500 mx-auto mb-1"></div>
                      Extracting table data...
                    </div>
                  )}
                </div>
              ))}
            </div>

            {capturedImages.length > 6 && (
              <div className="mt-4 text-center">
                <button
                  onClick={downloadAllImages}
                  className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mx-auto"
                >
                  <Download size={18} />
                  Download All {capturedImages.length} Images
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showMiniMap && pdfPages[currentPage] && (
        <div
          ref={miniMapRef}
          className="absolute bottom-4 right-4 w-32 h-40 border-2 border-gray-300 bg-white shadow-lg rounded cursor-pointer overflow-hidden z-10"
          onClick={handleMiniMapClick}
        >
          <div
            className="w-full h-full bg-cover bg-no-repeat"
            style={{
              backgroundImage: `url(${pdfPages[currentPage].imageData})`,
              backgroundSize: "100% 100%",
            }}
          />
          <div className="absolute top-0 left-0 bg-blue-500 text-white text-xs px-1 rounded-br">
            {currentPage + 1}/{totalPages}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMiniMap(false);
            }}
            className="absolute top-0 right-0 bg-white bg-opacity-70 hover:bg-opacity-100 p-1 rounded-bl"
            title="Hide Mini-map"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export default PDFCaptureTool;
