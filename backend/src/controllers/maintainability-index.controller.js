import AdmZip from 'adm-zip';
import phpParser from 'php-parser';
import { Parser as Json2CsvParser } from 'json2csv';

// Fungsi untuk membaca file Java dalam ZIP
const getPhpFilesFromZip = (zipBuffer) => {
  const zip = new AdmZip(zipBuffer);
  const phpFiles = [];

  zip.getEntries().forEach((entry) => {
    if (entry.entryName.endsWith('.php')) {
      const code = entry.getData().toString('utf-8');
      phpFiles.push({ fileName: entry.entryName, code });
    }
  });

  return phpFiles;
};

export const analyzeCodeFromZip = (req, res) => {
  try {
    const zipBuffer = req.file.buffer;
    const phpFiles = getPhpFilesFromZip(zipBuffer);

    const results = phpFiles.map(({ fileName, code }) => {
      const maintainability = calculateMaintainabilityIndex(code);

      return {
        fileName,
        maintainability,
      };
    });

    res.json({
      success: true,
      data1: results,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

function calculateMaintainabilityIndex(code) {
  const linesOfCode = code.split('\n').filter((line) => line.trim().length > 0).length;
  const singleLineComments = code.split('\n').filter((line) => line.includes('//')).length;
  const multiLineComments = (code.match(/\/\*[\s\S]*?\*\//g) || []).length;
  const commentLines = singleLineComments + multiLineComments;
  const perCM = (commentLines / linesOfCode) * 100;

  const controlFlowKeywords = ['if', 'else if', 'for', 'while', 'switch', 'case', 'catch'];
  const cyclomaticComplexity = controlFlowKeywords.reduce((complexity, keyword) => {
    const regex = keyword === 'else if' ? /\belse\s+if\b/g : new RegExp(`\\b${keyword}\\b`, 'g');
    const matches = code.match(regex);
    return complexity + (matches ? matches.length : 0);
  }, 1);

  const operatorRegex =
    /->|[+\-*/%&|^!~=]|\+\+|--|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|<<=|>>=|\?\:|\.\.\.|::|\.|\?\?=|@|==|===|!=|<>|!==|<=|>=|&&|\|\||<|>|\?=\?|if|else|elseif|for|while|foreach|switch|case|default|break|continue|goto|declare|try|catch|finally|throw|\(|\)|\{|\}|return/g;

  // Operand regex tetap sama
  const operandRegex =
    /(?:\$this(?:->\w+)?)|(?:\$[a-zA-Z_][a-zA-Z0-9_]*)|\b(?!function|class|public|private|protected|static|abstract|final|return|if|else|elseif|for|while|do|switch|case|try|catch|finally|foreach|new|instanceof|echo|mysqli_connect_error|string|int|float|bool|array|object|null|void|php|var|namespace|require|include|use|extends|implements|interface|trait)\w+\b|\d+(\.\d+)?|".*?"|'(.*?)'/g;

  const operators = code.match(operatorRegex) || [];
  const operands = code.match(operandRegex) || [];
  const n1 = new Set(operators).size;
  const n2 = new Set(operands).size;
  const N1 = operators.length;
  const N2 = operands.length;

  const halsteadVolume = (N1 + N2) * Math.log2(n1 + n2);

  let maintainabilityIndex = 171 - 5.2 * Math.log(halsteadVolume) - 0.23 * cyclomaticComplexity - 16.2 * Math.log(linesOfCode);

  maintainabilityIndex = Math.max(maintainabilityIndex, 0);

  let color = 'Green';
  let explanation = 'This code is highly maintainable.';
  if (maintainabilityIndex <= 65) {
    color = 'Red';
    explanation = 'This code is difficult to maintain and requires significant improvements.';
  } else if (maintainabilityIndex <= 85) {
    color = 'Yellow';
    explanation = 'This code is moderately maintainable and may benefit from refactoring or additional documentation.';
  }

  return {
    maintainabilityIndex,
    linesOfCode,
    commentLines,
    cyclomaticComplexity,
    halsteadVolume,
    perCM,
    color,
    explanation,
  };
}

export const detectDataClassSmell = (req, res) => {
  try {
    const zipBuffer = req.file.buffer;
    const phpFiles = getPhpFilesFromZip(zipBuffer);

    const dataClassResults = phpFiles
      .map(({ fileName, code }) => {
        // Cek apakah file punya class & hitung metriknya
        const className = extractPhpClassName(code);
        if (!className) {
          // Abaikan file tanpa kelas
          return null;
        }
        console.log('Class Name:', className);

        const classMetrics = analyzePhpClassMetrics(code);
        console.log('Class Metrics:', classMetrics);

        if (!classMetrics) {
          // Abaikan file tanpa kelas
          return null;
        }

        const { WMC, LCOM } = classMetrics;
        const isDataClassSmell = WMC > 50 || LCOM > 0.8;

        return {
          fileName,
          className,
          WMC,
          LCOM,
          isDataClassSmell,
        };
      })
      .filter((result) => result !== null); // Hanya tampilkan file dengan kelas

    res.json({
      success: true,
      data: dataClassResults,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

function extractPhpClassName(code) {
  const parser = new phpParser({
    parser: { extractDoc: true },
    ast: { withPositions: false },
  });

  try {
    const ast = parser.parseCode(code);
    const className = findClassNode(ast);
    return className || null; // Kembalikan nama kelas atau null jika tidak ditemukan
  } catch (err) {
    console.error('Parse error:', err);
    return null;
  }
}

// Fungsi untuk menelusuri AST dan menemukan nama kelas pertama yang ditemukan
function findClassNode(ast) {
  let className = null;

  const traverse = (node) => {
    if (node.kind === 'class') {
      className = node.name.name; // Ambil nama kelas
    }

    // Jika node memiliki children, telusuri lebih dalam
    if (Array.isArray(node.children)) {
      node.children.forEach(traverse);
    }

    // Jika node memiliki body, periksa itu juga
    if (Array.isArray(node.body)) {
      node.body.forEach(traverse);
    }
  };

  traverse(ast);
  return className;
}

// Fungsi analisis metrik kelas PHP
const analyzePhpClassMetrics = (code) => {
  const parser = new phpParser({
    parser: { extractDoc: true },
    ast: { withPositions: false },
  });

  let ast;
  try {
    ast = parser.parseCode(code);
    // console.log('Parsed AST:', JSON.stringify(ast, null, 2)); // Debug AST
  } catch (err) {
    // console.error('Parse error:', err);
    return null;
  }

  const classes = [];

  const walk = (node) => {
    if (!node) return;

    if (node.kind === 'class') {
      const classInfo = {
        methods: [],
        properties: new Set(),
        methodAccess: new Map(),
        content: node.loc ? node.loc.source : '',
      };

      node.body.forEach((element) => {
        if (element.kind === 'method') {
          const methodName = element.name.name;
          const accessedProps = new Set();

          const extractAccessedProps = (bodyNode) => {
            if (!bodyNode) return;

            if (bodyNode.kind === 'propertylookup' && bodyNode.what.kind === 'variable' && bodyNode.what.name === 'this' && bodyNode.offset.kind === 'identifier') {
              accessedProps.add(bodyNode.offset.name);
            }

            if (bodyNode.kind === 'assign' && bodyNode.left.kind === 'propertylookup' && bodyNode.left.what.kind === 'variable' && bodyNode.left.what.name === 'this' && bodyNode.left.offset.kind === 'identifier') {
              accessedProps.add(bodyNode.left.offset.name);
            }

            for (const key in bodyNode) {
              if (bodyNode[key] && typeof bodyNode[key] === 'object') {
                if (Array.isArray(bodyNode[key])) {
                  bodyNode[key].forEach(extractAccessedProps);
                } else {
                  extractAccessedProps(bodyNode[key]);
                }
              }
            }
          };

          extractAccessedProps(element.body);
          classInfo.methods.push(methodName);
          classInfo.methodAccess.set(methodName, accessedProps);
        }

        if (element.kind === 'property') {
          element.properties.forEach((prop) => {
            classInfo.properties.add(prop.name.name);
          });
        }
      });

      classes.push(classInfo);
    }

    for (const key in node) {
      if (node[key] && typeof node[key] === 'object') {
        if (Array.isArray(node[key])) {
          node[key].forEach(walk);
        } else {
          walk(node[key]);
        }
      }
    }
  };

  walk(ast);

  if (!classes.length) {
    return null;
  }

  const cls = classes[0];
  const methodCount = cls.methods.length;
  // const attributeCount = cls.properties.size;
  // Ekstrak jumlah properti dengan regex
  const propertyRegex = /\b(public|private|protected)\s+(?:static\s+)?(?:\w+\s+)?\$(\w+)/g;
  const properties = new Set();
  let match;
  while ((match = propertyRegex.exec(code)) !== null) {
    properties.add(match[2]);
  }

  const attributeCount = properties.size;
  console.log('DEBUG: Attribute Count →', attributeCount);

  if (methodCount == 0 || attributeCount == 0) {
    console.log('HAIIIIIII perttama');
    return {
      WMC: methodCount,
      LCOM: 0,
      methodCount,
      propertyCount: attributeCount,
    };
  }

  let sumInverseEta = 0;
  let totalUniqueAttributes = new Set();

  for (const method of cls.methods) {
    const accessedProps = cls.methodAccess.get(method) || new Set();
    if (accessedProps.size > 0) {
      sumInverseEta += 1 / accessedProps.size;
    }
    accessedProps.forEach((prop) => totalUniqueAttributes.add(prop));
  }

  console.log('Hasilnya class' + cls.name);

  const a = totalUniqueAttributes.size;
  console.log('a count' + a);
  const LCOM_new1 = (1 / methodCount) * sumInverseEta - (a > 0 ? 1 / a : 0);

  return {
    WMC: methodCount,
    LCOM: LCOM_new1,
    methodCount,
    propertyCount: attributeCount,
  };
};

export const detectParallelInheritanceHierarchies = (req, res) => {
  try {
    const zipBuffer = req.file.buffer;
    const phpFiles = getPhpFilesFromZip(zipBuffer);

    // Bangun inheritance map yang menyimpan DIT, NOC, fileName
    const inheritanceMap = buildInheritanceMap(phpFiles);

    // Buat hasil deteksi berdasarkan DIT dan NOC
    const hierarchyResults = Object.entries(inheritanceMap).map(([className, data]) => {
      const { DIT, NOC, fileName } = data;
      const isParallelInheritanceSmell = DIT > 3 || NOC > 4;

      return {
        fileName,
        className,
        DIT,
        NOC,
        isParallelInheritanceSmell,
      };
    });

    res.json({
      success: true,
      data: hierarchyResults,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

const buildInheritanceMap = (phpFiles) => {
  const parser = new phpParser({
    parser: { extractDoc: true },
    ast: { withPositions: false },
  });

  const classes = {};

  phpFiles.forEach(({ fileName, code }) => {
    let ast;
    try {
      ast = parser.parseCode(code);
    } catch (err) {
      console.error(`Parse error in file ${fileName}:`, err);
      return;
    }

    walkAstForInheritance(ast, classes, fileName);
  });

  // Hitung DIT dan NOC untuk setiap kelas setelah AST selesai diproses
  Object.keys(classes).forEach((className) => {
    classes[className].DIT = calculateDIT(className, classes);
    classes[className].NOC = calculateNOC(className, classes);
  });

  return classes;
};

const walkAstForInheritance = (node, classes, fileName) => {
  if (!node) return;

  if (node.kind === 'class') {
    const className = node.name.name;
    const parentName = node.extends ? node.extends.name : null;

    // Tambahkan fileName ke data class
    classes[className] = classes[className] || {
      parents: [],
      children: [],
      fileName: fileName, //  assign fileName di sini
    };

    if (parentName) {
      classes[className].parents.push(parentName);

      // Pastikan parent ada di map, walau belum dianalisis, dan tambahkan child
      classes[parentName] = classes[parentName] || {
        parents: [],
        children: [],
        fileName: null,
      };

      classes[parentName].children.push(className);
    }
  }

  // Rekursif telusuri node anak
  for (const key in node) {
    if (node[key] && typeof node[key] === 'object') {
      if (Array.isArray(node[key])) {
        node[key].forEach((subNode) => walkAstForInheritance(subNode, classes, fileName));
      } else {
        walkAstForInheritance(node[key], classes, fileName);
      }
    }
  }
};

const calculateDIT = (className, classes, visited = new Set()) => {
  if (!classes[className] || classes[className].parents.length === 0) {
    return 0;
  }

  let totalDIT = 0;

  classes[className].parents.forEach((parent) => {
    if (!visited.has(parent)) {
      visited.add(parent);
      totalDIT += 1 + calculateDIT(parent, classes, visited);
    }
  });

  return totalDIT;
};

const calculateNOC = (className, classes) => {
  // Pastikan kelas ada dan memiliki anak langsung
  if (!classes[className] || !classes[className].children) {
    return 0;
  }

  // Cukup kembalikan jumlah anak langsung (children) dari kelas tersebut
  return classes[className].children.length;
};

export const exportCsv = (req, res) => {
  const { analysisResults, dataClassResults, parallelResults } = req.body;

  if (!analysisResults || !Array.isArray(analysisResults) || analysisResults.length === 0) {
    return res.status(400).json({ error: 'No data to export' });
  }

  try {
    // Gabungkan data maintainability index dengan data smells
    const csvData = analysisResults.map((result) => {
      const fileName = result.fileName || 'Unknown';
      const maintainabilityIndex = result.maintainability?.maintainabilityIndex?.toFixed(2) || '';
      const explanation = result.maintainability.explanation || 'N/A';

      // Cari data class detection untuk file ini
      const dataClassResult = dataClassResults?.find((item) => item.fileName === fileName);

      const dataClassName = dataClassResult?.className || '';
      const dataClassWMC = dataClassResult?.WMC || '';
      const dataClassLCOM = dataClassResult?.LCOM || '';
      const dataClassDetected = dataClassResult?.isDataClassSmell ? 'Yes' : 'No';

      // Cari parallel inheritance detection untuk file ini
      const parallelResult = parallelResults?.find((item) => item.fileName === fileName);
      const parallelInheritanceClassName = parallelResult?.className || '';
      const parallelInheritanceDIT = parallelResult?.DIT || '';
      const parallelInheritanceNOC = parallelResult?.NOC || '';
      const parallelInheritanceDetected = parallelResult?.isParallelInheritanceSmell ? 'Yes' : 'No';

      return {
        'File Name': fileName,
        'Maintainability Index': maintainabilityIndex,
        Explanation: explanation,
        'Class Name': dataClassName,
        'Weighted Methods per Class': dataClassWMC,
        'Lack of Cohesion of Methods': dataClassLCOM,
        'Data Class Detected': dataClassDetected,
        'Depth of Inheritance Tree': parallelInheritanceDIT,
        'Number of Children': parallelInheritanceNOC,
        'Parallel Inheritance Detected': parallelInheritanceDetected,
      };
    });

    // Buat nama kolom secara dinamis
    const fields = Object.keys(csvData[0]); // Ambil semua kunci dari objek pertama di csvData
    const json2csvParser = new Json2CsvParser({ fields });
    const csv = json2csvParser.parse(csvData);

    // Kirim file CSV
    res.header('Content-Type', 'text/csv');
    res.attachment('analysis_results.csv');
    return res.send(csv);
  } catch (error) {
    console.error('Error generating CSV:', error);
    return res.status(500).json({ error: 'Failed to generate CSV file' });
  }
};
