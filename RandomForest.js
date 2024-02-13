//Import the area of interest shapefile (check Import entry panel)
//Import Sentinel-1 collection (check Import entry panel)
//Import Sentinel-2 collection (check Import entry panel)

//Filter Sentinel-1 collection based on the study area,...
//...,date ranges and polarisation components
var s1Collection = sentinel1
                    // filter by aoi and time (Jan 2021 - Dec 2022)
                    .filterBounds(aoi)
                    .filterDate('2022-01-01', '2022-12-30');
                    // // filter to access images with VV and VH dual polarisation
                    // .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
                    // .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
                    // //filter to access images collected in interferometric wideswath mode
                    // .filter(ee.Filter.eq('InstrumentMode', 'IW'))
                    // .select(['VV', 'VH']);
                    
  var asc = s1Collection.filter(ee.Filter.eq('orbitProperties_pass', 'ASCENDING'));
  var desc = s1Collection.filter(ee.Filter.eq('orbitProperties_pass', 'DESCENDING'));
  
  var vvvhAsc = asc
                  // Filter to get images with VV and VH single polarization
                .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
                .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
                  // Filter to get images collected in interferometric wide swath mode.
                .filter(ee.Filter.eq('instrumentMode', 'IW'));

 var vvvhDesc = desc
                  // Filter to get images with VV and VH single polarization
                .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
                .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
                  // Filter to get images collected in interferometric wide swath mode.
                .filter(ee.Filter.eq('instrumentMode', 'IW'));


// Create a composite from the means of the data
// ... at different polarisations and look angles
var composite = ee.Image.cat ([
                vvvhAsc.select('VV').median(),
                vvvhAsc.select('VH').median(),
                vvvhDesc.select('VV').median(),
                vvvhDesc.select('VH').median(),
                ]).clip(aoi);
                
// rename the bands for quick identification post stacking
var s1composite = composite.select(
                  ['VV','VH','VV_1','VH_1'], // old names
                  ['s1vva','s1vha','s1vvd','s1vhd'] // new names
                  );
                
// Filter them monthly, and create a median value for each

var s1_Jan = s1Collection.filter(ee.Filter.dayOfYear(1,31))
.median();
var s1_Feb = s1Collection.filter(ee.Filter.dayOfYear(32,59))
.median();
var s1_Mar = s1Collection.filter(ee.Filter.dayOfYear(60,90))
.median();
var s1_Apr = s1Collection.filter(ee.Filter.dayOfYear(91,120))
.median();
var s1_May = s1Collection.filter(ee.Filter.dayOfYear(121,151))
.median();
var s1_Jun = s1Collection.filter(ee.Filter.dayOfYear(152,181))
.median();
var s1_Jul = s1Collection.filter(ee.Filter.dayOfYear(182,212))
.median();
var s1_Aug = s1Collection.filter(ee.Filter.dayOfYear(213,243))
.median();
var s1_Sep = s1Collection.filter(ee.Filter.dayOfYear(244,273))
.median();
var s1_Oct = s1Collection.filter(ee.Filter.dayOfYear(274,304))
.median();
var s1_Nov = s1Collection.filter(ee.Filter.dayOfYear(305,335))
.median();
var s1_Dec = s1Collection.filter(ee.Filter.dayOfYear(336,366))
.median();

// Create a multiband composite image
var S1_imagestack = ee.Image.cat ([s1_Jan, s1_Feb, s1_Mar, s1_Apr, s1_May, s1_Jun, s1_Jul, s1_Aug, s1_Sep, s1_Oct, s1_Nov, s1_Dec].map(function(band){
  return ee.Image(band).clip(aoi);
}));

print ('Sentinel 1 Stack', S1_imagestack);


// Function to add band ratio (VV/VH) to the image
var addBandRatio = function(image) {
  var vvBand = image.select('VV', 'VV_1', 'VV_2', 'VV_3', 
                            'VV_4', 'VV_5', 'VV_6', 'VV_7', 
                            'VV_8', 'VV_9', 'VV_10', 'VV_11');
  var vhBand = image.select('VH', 'VH_1','VH_2', 'VH_3', 
                            'VH_4', 'VH_5', 'VH_6', 'VH_7', 
                            'VH_8', 'VH_9', 'VH_10', 'VH_11');
  
  var ratioBand = vvBand.subtract(vhBand).rename('VV_VH_ratio', 'VV_VH_ratio1', 'VV_VH_ratio2',
                                                  'VV_VH_ratio3', 'VV_VH_ratio4', 'VV_VH_ratio5', 
                                                  'VV_VH_ratio6', 'VV_VH_ratio7', 'VV_VH_ratio8', 
                                                  'VV_VH_ratio9', 'VV_VH_ratio10', 'VV_VH_ratio11');
  
  return image.addBands(ratioBand);
};

// Apply the function to the Sentinel-1 image stack
var S1compositeWithRatio = addBandRatio(S1_imagestack);
print ("Composite Bands with Ratio", S1compositeWithRatio);

// Apply mean reducer function to the Sentinel-1 image stack
var sentinel1_mean = S1compositeWithRatio.reduce(ee.Reducer.mean());
print ("sentinel1 mean imagery", sentinel1_mean);

// // Display the composite image
// Map.centerObject(aoi, 11);
// Map.addLayer(S1compositeWithRatio, {bands: ['VH', 'VV', 'VV_VH_ratio'],
//                 min: [-30, -25, 0],
//                 max: [-5, 0, 15]});


//Dataset 2: Sentinel 2 Imagery - collection, preprocessing and visualization
// Specify the band combination for the False Colour Composite
var FCC = {bands: ['B8', 'B4', 'B3'], min: 0, max: 3000};

var dataset = ee.ImageCollection('COPERNICUS/S2')
                  .filterDate('2022-01-01', '2022-12-30')
                  // Pre-filter to get less cloudy granules.
                  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE',5))
                  .filterBounds(aoi)
                  // .map(maskS2clouds)
                  .map(function(img) {return img.clip(aoi)});
print (dataset, "Sentinel 2-2022");

var listdataset = dataset.toList(dataset.size());
print (listdataset, "2022 Sentinel 2 dataset list");

var S2_Image = ee.Image(listdataset.get(8)).clip(aoi);
// Map.addLayer(S2_Image, FCC, "Sentinel 2_FCC");

var S2_imagecollection = ee.ImageCollection([ee.Image(listdataset.get(1)), 
                                            ee.Image(listdataset.get(2)), 
                                            ee.Image(listdataset.get(8)), 
                                            ee.Image(listdataset.get(10))])
                                            .select(['B2', 'B3', 'B4', 'B5', 'B6', 
                                            'B7', 'B8', 'B8A', 'B11', 'B12']);

print (S2_imagecollection, 'Sentinel 2 Image cloud-free image collection');                     

//Stack the Sentinel 2 imagery
var imagestack = function (S2_imagecollection) {
  var first = ee.Image(S2_imagecollection.first()).select([]);
  var appendBands = function (image, previous) {
    return ee.Image(previous).addBands(image);
  };
  return ee.Image(S2_imagecollection.iterate(appendBands, first));
};

var S2_imagestack = imagestack(S2_imagecollection);
print (S2_imagestack, "Stacked Sentinel 2 Imageries");

// Function to calculate vegetation indices
var calculateIndices = function(image) {
  // Calculate NDVI (Normalised Difference Vegetation Index)
  var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
  
  // Calculate SAVI (Soil Adjusted Vegetation Index)
  var savi = image.expression(
    '(1 + L) * (NIR - Red) / (NIR + Red + L)',
    {
      'NIR': image.select('B8'),
      'Red': image.select('B4'),
      'L': 0.5
    }
  ).rename('SAVI');
  
  // Calculate NDWI (Normalised Difference Vegetation Index)
  var ndwi = image.expression(
    '(NIR - SWIR)/(NIR + SWIR)',
    {
      'NIR': image.select ('B8'),
      'SWIR': image.select ('B11')
    }
    ).rename('NDWI');
  
  // Calculate MSI (Moisture Stress Index)
  var msi = image.expression(
    '(NIR - Red) / (SWIR1 + Red)',
    {
      'NIR': image.select('B8'),
      'Red': image.select('B4'),
      'SWIR1': image.select('B11')
    }
  ).rename('MSI');
  
  // Calculate ENDVI (Enhanced Normalised Difference Vegetation Index)
  var endvi = image.expression(
    '(NIR + Red - 2 * Blue) / (NIR + Red + 2 * Blue)',
    {
      'NIR': image.select('B8'),
      'Red': image.select('B4'),
      'Blue': image.select('B2')
    }
  ).rename('ENDVI');
  
  return image.addBands([ndvi, savi, ndwi, msi, endvi]);
};

// Apply the function to the Sentinel-2 image
var imageWithIndices = calculateIndices(S2_imagestack);

// Print the result to the console
print('Sentinel-2 image with vegetation indices:', imageWithIndices);

// Display the RGB image and the vegetation indices on the map
Map.centerObject(aoi, 12);
Map.addLayer(imageWithIndices, {
  bands: ['B4', 'B3', 'B2'],
  min: 0,
  max: 3000,
  gamma: 1.4
}, 'RGB');

Map.addLayer(imageWithIndices.select(['NDVI']), {min: -1, max: 1, palette: ['red', 'yellow', 'green']}, 'NDVI');
Map.addLayer(imageWithIndices.select(['SAVI']), {min: -1, max: 1, palette: ['red', 'yellow', 'green']}, 'SAVI');
Map.addLayer(imageWithIndices.select(['NDWI']), {min: -1, max: 1, palette: ['blue', 'white', 'green']}, 'NDWI');
Map.addLayer(imageWithIndices.select(['MSI']), {min: -1, max: 1, palette: ['brown', 'yellow', 'green']}, 'MSI');
Map.addLayer(imageWithIndices.select(['ENDVI']), {min: -1, max: 1, palette: ['red', 'yellow', 'green']}, 'ENDVI');

print (GroundRefPoint, 'Ground Reference Points');
// Add the ground reference point to the map
Map.centerObject(aoi, 10); // Center the map on the loaded features
Map.addLayer(GroundRefPoint, {color: 'red'}, 'Ground Reference Points');

//Filter the data into six classes based on the Field : "Incidents type"
var pollutedTCA = GroundRefPoint.filter(ee.Filter.eq('Incident_t', 'Polluted Tree Cover Areas'));
var pollutedGrassland = GroundRefPoint.filter(ee.Filter.eq('Incident_t', 'Polluted Grassland'));
var pollutedCropland = GroundRefPoint.filter(ee.Filter.eq('Incident_t', 'Polluted Cropland'));
var nonPollutedTCA = GroundRefPoint.filter(ee.Filter.eq('Incident_t', 'Non - polluted Tree Cover Areas'));
var nonPollutedGrassland = GroundRefPoint.filter(ee.Filter.eq('Incident_t', 'Non - polluted Grassland'));
var nonPollutedCropland = GroundRefPoint.filter(ee.Filter.eq('Incident_t', 'Non - polluted Cropland'));

// Add each class as a separate layer to the map
Map.centerObject(aoi, 10);

// Map.addLayer(pollutedTCA, {color: 'red'}, 'Polluted TCA');
// Map.addLayer(pollutedGrassland, {color: 'black'}, 'Polluted Grassland');
// Map.addLayer(pollutedCropland, {color: 'brown'}, 'Polluted Cropland');
// Map.addLayer(nonPollutedTCA, {color: 'green'}, 'Non-polluted TCA');
// Map.addLayer(nonPollutedGrassland, {color: 'blue'}, 'Non-polluted Grassland');
// Map.addLayer(nonPollutedCropland, {color: 'purple'}, 'Non-polluted Cropland');


//Image Classification
var polygon = pollutedTCA.merge(pollutedGrassland).merge(pollutedCropland)
              .merge(nonPollutedTCA).merge(nonPollutedGrassland).merge(nonPollutedCropland);

print(polygon, 'Training data');

// Split the classes into training and validation samples
var data = polygon.randomColumn();
var trainingsample = data.filter ('random <= 0.5');
var validationsample = data.filter ('random > 0.5');

//print the dataset into the console tab
print(trainingsample, "Training dataset");
print (validationsample, "Validation dataset");

// Combine all the layers into a single image for training and 
//...classification purposes
var combinedImage1 = ee.Image.cat(S1compositeWithRatio, imageWithIndices.select(['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B8A', 'B11', 'B12', 'NDVI','MSI', 'NDWI', 'SAVI', 'ENDVI']), LCA);
print (combinedImage1, "Sentinel 1, Sentinel 2 and Land Cover Areas image stack");

var training = combinedImage1.sampleRegions({
    collection: trainingsample,
    properties: ['Incident_C'],
    scale: 20
});
print (training, 'Training data band values');

var validation = combinedImage1.sampleRegions({
    collection: validationsample,
    properties: ['Incident_C'],
    scale: 20
});

print (validation, "Validation data band values");

var feature = training.first(); // Get the first feature for inspection
print('Feature Properties:', feature.toDictionary());

//Random Forest Model Building
//ee.Classifier.smileRandomForest(numberOfTrees, variablesPerSplit, minLeafPopulation, bagFraction,maxNodes, seed)

var RFclassifier = ee.Classifier.smileRandomForest(800).train(training, 'Incident_C');

var Classified = combinedImage1.classify(RFclassifier).clip(aoi);
print (Classified, 'Classified Imagery');

var Palette = ['Yellow', //Polluted TCA
'Green', // Polluted Grassland
'Blue', // Polluted Cropland
'Grey', // Non-Polluted TCA
'Cyan',// Non-Polluted Grassland
'Purple'// Non-Polluted Cropland
];

Map.addLayer (Classified, {palette: Palette, min: 1, max: 6}, 'Classified Map');

//Accuracy Assessment

//Derive a confusion matrix and overall accuracy for the training dataset
var trainingAccuracy = RFclassifier.confusionMatrix();
print (trainingAccuracy,'Training error matrix');
print (trainingAccuracy.accuracy(), 'Training Overall accuracy');

//Derive a confusion matrix and overall accuracy for the validation dataset
var validation2 = validation.classify(RFclassifier);
var validationAccuracy = validation2.errorMatrix("Incident_C", 'classification');
print (validationAccuracy, 'Validation error matrix');
print(validationAccuracy.accuracy(), 'Validation accuracy');

//Variable Importance
var explain = RFclassifier.explain();
print (explain, 'Explain');

//Variable Importance of Random Forest Classifier
var variable_importance = ee.Feature(null, ee.Dictionary(explain).get('importance'));

//Chart of Variable Importance of Random Forest Classifier
var chartTitle = "Random Forests Classifier: Bands Variable Importance";
var chart = 
    ui.Chart.feature.byProperty(variable_importance)
      .setChartType('BarChart')
      .setOptions({
        title: chartTitle,
        legend: {position: 'none'},
        hAxis: {title: 'Importance'},
        vAxis: {title: 'Bands'}
      });
    // Chart: Location and Plot
  chart.style().set({
    position: 'bottom-left',
    width: '500px',
    height: '500px'
  });

// Map.add(chart);

//Export the classified Imagery to the Drive
Export.image.toDrive ({
  image: Classified,
  description: "Classified Imagery using RF",
  region: aoi,
  scale: 20,
  fileFormat: "GeoTIFF",
  maxPixels: 1e9
});
