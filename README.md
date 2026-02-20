# 🌍 Land Pollution Detection Using Sentinel-1 & Sentinel-2 Imagery (Google Earth Engine)

A Google Earth Engine (GEE) JavaScript script for detecting and classifying **polluted and non-polluted land cover areas** using multi-sensor satellite imagery and a Random Forest machine learning classifier.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Study Area & Time Period](#study-area--time-period)
- [Prerequisites](#prerequisites)
- [Required Assets & Imports](#required-assets--imports)
- [Workflow Summary](#workflow-summary)
- [Dataset 1: Sentinel-1 SAR Imagery](#dataset-1-sentinel-1-sar-imagery)
- [Dataset 2: Sentinel-2 Multispectral Imagery](#dataset-2-sentinel-2-multispectral-imagery)
- [Vegetation & Spectral Indices](#vegetation--spectral-indices)
- [Ground Reference Data & Classification Classes](#ground-reference-data--classification-classes)
- [Image Classification (Random Forest)](#image-classification-random-forest)
- [Accuracy Assessment](#accuracy-assessment)
- [Variable Importance](#variable-importance)
- [Export](#export)
- [Map Visualisation](#map-visualisation)
- [Limitations & Known Issues](#limitations--known-issues)
- [Suggested Improvements](#suggested-improvements)

---

##  Overview

This script leverages the complementary strengths of two ESA Copernicus satellite missions:

- **Sentinel-1** — C-band Synthetic Aperture Radar (SAR), which penetrates cloud cover and captures surface roughness and dielectric properties.
- **Sentinel-2** — Multispectral optical imagery, providing rich spectral information for vegetation and land surface characterisation.

By fusing both sensors and computing additional spectral indices, the script builds a **feature-rich combined image stack** that is used to train and apply a **Random Forest classifier** to map six classes of polluted and non-polluted land cover.

---

## Study Area & Time Period

| Parameter       | Value                          |
|----------------|--------------------------------|
| Study Period    | 1 January 2022 – 30 December 2022 |
| Sensor 1        | Sentinel-1 SAR (C-band)        |
| Sensor 2        | Sentinel-2 Multispectral       |
| Map Scale       | 20 metres                      |
| Output Format   | GeoTIFF                        |

 The Area of Interest (`aoi`) must be imported as a shapefile or geometry asset within GEE's import panel.

---

## Prerequisites

Before running this script, ensure you have:

1. A **Google Earth Engine account** — [Sign up here](https://earthengine.google.com/)
2. Access to the **GEE Code Editor** — [code.earthengine.google.com](https://code.earthengine.google.com/)
3. The following assets uploaded or accessible in GEE:
   - Area of Interest (AOI) shapefile
   - Ground reference point feature collection
   - Land Cover Areas (LCA) layer

---

## Data used

The following imports must be configured in the GEE **Import Entry Panel** at the top of the code editor:

| Import Variable    | Type                  | Description                                              |
|--------------------|-----------------------|----------------------------------------------------------|
| `aoi`              | Geometry / FeatureCollection | Study area boundary shapefile                  |
| `sentinel1`        | ImageCollection       | `COPERNICUS/S1_GRD` — Sentinel-1 Ground Range Detected  |
| `sentinel2`        | ImageCollection       | `COPERNICUS/S2` — Sentinel-2 Level-1C                   |
| `GroundRefPoint`   | FeatureCollection     | Ground-truthed reference points with `Incident_t` and `Incident_C` fields |
| `LCA`              | Image / FeatureCollection | Existing Land Cover Areas layer                     |

---

## Workflow Summary

```
Raw Sentinel-1 & Sentinel-2 Collections
            │
            ▼
    Filter by AOI, Date & Cloud Cover
            │
            ▼
    Sentinel-1: Monthly Composites + Band Ratios (VV/VH)
    Sentinel-2: Cloud-free Stack + Spectral Indices
            │
            ▼
    Combine into a Single Multi-band Feature Image
            │
            ▼
    Sample using Ground Reference Points (Training & Validation)
            │
            ▼
    Train Random Forest Classifier (800 Trees)
            │
            ▼
    Classify Combined Image → 6-Class Land Pollution Map
            │
            ▼
    Accuracy Assessment (Training & Validation Error Matrices)
            │
            ▼
    Variable Importance Chart + Export to Google Drive
```

---

## Dataset 1: Sentinel-1 SAR Imagery

### Collection & Filtering

The Sentinel-1 collection is filtered by:
- **Bounds** — clipped to the AOI
- **Date** — January to December 2022
- **Orbit pass** — separated into **Ascending** and **Descending** orbits
- **Polarisation** — VV and VH dual-polarisation
- **Instrument Mode** — Interferometric Wide (IW) swath

### Annual Composite

An annual composite is created by taking the **median** backscatter values across:

| Band Name | Description                          |
|-----------|--------------------------------------|
| `s1vva`   | Ascending VV polarisation (median)   |
| `s1vha`   | Ascending VH polarisation (median)   |
| `s1vvd`   | Descending VV polarisation (median)  |
| `s1vhd`   | Descending VH polarisation (median)  |

### Monthly Composites

The collection is further filtered into **12 monthly composites** using `ee.Filter.dayOfYear()`. A median reducer is applied per month, resulting in monthly SAR snapshots capturing seasonal backscatter dynamics.

### Band Ratio (VV/VH)

A **VV–VH difference band** (used as a ratio proxy) is computed for each month using:

```
VV_VH_ratio = VV - VH
```

This ratio enhances separation between different surface types, as various land cover classes respond differently to VV vs. VH polarisation.

The result is a **36-band Sentinel-1 image stack** (12 months × 3 bands: VV, VH, VV_VH_ratio) reduced to mean values for use in classification.

---

## Dataset 2: Sentinel-2 Multispectral Imagery

### Collection & Filtering

The Sentinel-2 collection is filtered by:
- **Date** — January to December 2022
- **Cloud cover** — less than **5%** (`CLOUDY_PIXEL_PERCENTAGE`)
- **Bounds** — clipped to the AOI

### Image Stacking

Four cloud-free images are manually selected from the filtered collection (indices 1, 2, 8, 10) and stacked into a **multi-temporal image** using an iterative `addBands` approach. The following **10 spectral bands** are retained:

| Band  | Wavelength     | Description                  |
|-------|----------------|------------------------------|
| B2    | Blue (~490 nm) | Coastal aerosol / deep water |
| B3    | Green (~560 nm)| Vegetation & water           |
| B4    | Red (~665 nm)  | Chlorophyll absorption       |
| B5    | Red Edge (~705 nm) | Vegetation stress         |
| B6    | Red Edge (~740 nm) | Canopy structure          |
| B7    | Red Edge (~783 nm) | LAI estimation            |
| B8    | NIR (~842 nm)  | Biomass, vegetation vigour   |
| B8A   | Narrow NIR (~865 nm) | Vegetation / water     |
| B11   | SWIR (~1610 nm)| Soil moisture, mineralogy    |
| B12   | SWIR (~2190 nm)| Vegetation water content     |

---

## Vegetation & Spectral Indices

Five spectral indices are computed from the Sentinel-2 stack to enhance discrimination between polluted and healthy vegetation:

### 1. NDVI — Normalised Difference Vegetation Index
```
NDVI = (B8 - B4) / (B8 + B4)
```
> Measures vegetation greenness and density. Low NDVI may indicate stressed or absent vegetation in polluted areas.

### 2. SAVI — Soil Adjusted Vegetation Index
```
SAVI = (1 + L) * (B8 - B4) / (B8 + B4 + L)   where L = 0.5
```
> Corrects NDVI for soil brightness effects in sparsely vegetated areas such as degraded or polluted cropland.

### 3. NDWI — Normalised Difference Water Index
```
NDWI = (B8 - B11) / (B8 + B11)
```
> Sensitive to plant water content and moisture stress. Useful for detecting drought-like conditions caused by soil pollution.

### 4. MSI — Moisture Stress Index
```
MSI = (B8 - B4) / (B11 + B4)
```
> Captures moisture-related vegetation stress. Elevated MSI values may correlate with pollutant-induced physiological stress.

### 5. ENDVI — Enhanced Normalised Difference Vegetation Index
```
ENDVI = (B8 + B4 - 2 * B2) / (B8 + B4 + 2 * B2)
```
> An enhanced variant of NDVI incorporating blue reflectance to reduce atmospheric and canopy effects.

---

## Ground Reference Data & Classification Classes

### Source

Ground reference points are imported as a **FeatureCollection** (`GroundRefPoint`) containing field-collected observations. The key attribute fields are:

| Field Name    | Description                                 |
|---------------|---------------------------------------------|
| `Incident_t`  | Text label of the incident/land cover type  |
| `Incident_C`  | Numeric class code (1–6) for classification |

### Six Land Cover Classes

| Class Code | Class Label                  | Map Colour |
|------------|------------------------------|------------|
| 1          | Polluted Tree Cover Areas    | Yellow     |
| 2          | Polluted Grassland           | Green      |
| 3          | Polluted Cropland            | Blue       |
| 4          | Non-Polluted Tree Cover Areas| Grey       |
| 5          | Non-Polluted Grassland       | Cyan       |
| 6          | Non-Polluted Cropland        | Purple     |

### Training / Validation Split

The reference dataset is randomly split into two subsets using a **random column** approach:

| Subset     | Filter Condition       | Approx. Share |
|------------|------------------------|---------------|
| Training   | `random <= 0.5`        | ~50%          |
| Validation | `random > 0.5`         | ~50%          |

---

##  Image Classification (Random Forest)

### Feature Image (Combined Stack)

All input datasets are concatenated into a single multi-band image for classification:

```
combinedImage1 = Sentinel-1 composite (with ratios)
               + Sentinel-2 bands [B2, B3, B4, B5, B6, B7, B8, B8A, B11, B12]
               + Spectral indices [NDVI, MSI, NDWI, SAVI, ENDVI]
               + Land Cover Areas (LCA)
```

### Random Forest Configuration

```javascript
ee.Classifier.smileRandomForest(800)
```

| Parameter      | Value                        |
|----------------|------------------------------|
| Number of Trees| 800                          |
| Label Property | `Incident_C`                 |
| Sampling Scale | 20 metres                    |

> A larger number of trees generally improves stability and accuracy at the cost of computation time.

---

## Accuracy Assessment

Two separate accuracy assessments are performed:

### Training Accuracy
Derived directly from the classifier's internal confusion matrix:
```javascript
var trainingAccuracy = RFclassifier.confusionMatrix();
```
> ⚠️ Training accuracy is typically optimistic (can approach 100%) as the model has seen the training data. Use validation accuracy for a fairer evaluation.

### Validation Accuracy
Derived by classifying the held-out validation samples and computing an error matrix:
```javascript
var validationAccuracy = validation2.errorMatrix("Incident_C", 'classification');
```

Both the **confusion matrix** and **overall accuracy** are printed to the GEE console.

---

## Variable Importance

After classification, the importance of each input band (feature) to the Random Forest model is extracted and visualised:

```javascript
var explain = RFclassifier.explain();
```

A **horizontal bar chart** is generated in the GEE console showing the relative importance of each band/index in driving classification decisions. This helps identify:
- Which SAR polarisation bands are most discriminative
- Which spectral indices best separate polluted from non-polluted areas
- Whether seasonal SAR bands outperform annual composites

---

## Export

The final classified map is exported to **Google Drive** as a GeoTIFF:

```javascript
Export.image.toDrive({
  image: Classified,
  description: "Classified Imagery using RF",
  region: aoi,
  scale: 20,
  fileFormat: "GeoTIFF",
  maxPixels: 1e9
});
```

| Export Parameter | Value               |
|-----------------|---------------------|
| File Name       | Classified Imagery using RF |
| Format          | GeoTIFF             |
| Spatial Resolution | 20 metres        |
| Max Pixels      | 1,000,000,000       |

> The exported file can be opened in GIS software (e.g., QGIS, ArcGIS) for further spatial analysis.

---

## 🗺️ Map Visualisation

The following layers are added to the GEE interactive map:

| Layer Name              | Description                                              |
|------------------------|----------------------------------------------------------|
| RGB                     | True colour Sentinel-2 composite (B4, B3, B2)           |
| NDVI                    | Vegetation index (red → yellow → green palette)         |
| SAVI                    | Soil-adjusted vegetation (red → yellow → green)         |
| NDWI                    | Water/moisture index (blue → white → green)             |
| MSI                     | Moisture stress (brown → yellow → green)                |
| ENDVI                   | Enhanced vegetation (red → yellow → green)              |
| Ground Reference Points | Field-collected reference locations (red)               |
| Classified Map          | 6-class pollution map with custom colour palette        |

---

## ⚠️ Limitations & Known Issues

- **Commented-out filters**: Several Sentinel-1 filters (VV/VH selection, IW mode) are commented out in the initial collection filter and applied later. This is redundant and could cause confusion.
- **Manual image selection**: Sentinel-2 images are manually selected by index (`.get(1)`, `.get(2)`, etc.), which is fragile — changes in the collection could silently alter results.
- **Fixed random split**: The 50/50 split uses a random column but has no fixed seed, meaning results may vary slightly between runs.
- **`dayOfYear` filter**: Monthly composites use day-of-year filters that do not account for leap years and may be off by one day in some months.
- **Training accuracy inflation**: Reporting training accuracy alongside validation accuracy may be misleading without clearly noting the distinction.
- **Cloud masking**: The `maskS2clouds` function is referenced in a comment but not applied — cloud artefacts in the 5% threshold images may affect index calculations.

---

## 💡 Suggested Improvements

1. **Add a fixed seed** to `randomColumn()` for reproducible train/validation splits.
2. **Automate image selection** using a cloud-scored or NDVI-based best-pixel composite instead of manual indexing.
3. **Apply cloud masking** (`maskS2clouds`) to each Sentinel-2 image before stacking.
4. **Add Kappa coefficient** alongside overall accuracy for a more robust validation metric.
5. **Cross-validate** using k-fold cross-validation to better estimate generalisation performance.
6. **Parameterise** key variables (date range, cloud threshold, RF tree count) at the top of the script for easier configuration.

---

## 📚 References

- [Google Earth Engine Documentation](https://developers.google.com/earth-engine)
- [Sentinel-1 SAR GRD — GEE Data Catalogue](https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S1_GRD)
- [Sentinel-2 MSI Level-1C — GEE Data Catalogue](https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2)
- Rouse, J.W. et al. (1974) — *NDVI: Monitoring Vegetation Systems in the Great Plains with ERTS*
- Huete, A.R. (1988) — *SAVI: A soil-adjusted vegetation index*
- Gao, B.C. (1996) — *NDWI: A normalized difference water index for remote sensing of vegetation liquid water from space*

---

## 👤 Author

> Update this section with your name, institution, and contact details.

| Field        | Details         |
|--------------|-----------------|
| Author       | Oluwatobiloba Oyedero |
| Contact      | oluwatobiloba.oyedero@gmail.com |
| Last Updated | 2024 |

---

*This project was developed using Google Earth Engine and is intended for environmental monitoring and research purposes.*
