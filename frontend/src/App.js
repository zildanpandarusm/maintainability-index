import React, { useState } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import './App.css';
import config from './config';
const COLORS = ['#008000', '#FFD700', '#FF0000']; // Green, Yellow, Red

const calculatePieChartData = (results) => {
  let high = 0,
    moderate = 0,
    low = 0;

  results.forEach((result) => {
    const index = result.maintainability.maintainabilityIndex;
    if (index > 85) {
      high++;
    } else if (index > 65) {
      moderate++;
    } else {
      low++;
    }
  });

  const total = results.length;

  return [
    { name: 'High', value: high, percent: ((high / total) * 100).toFixed(2) },
    { name: 'Moderate', value: moderate, percent: ((moderate / total) * 100).toFixed(2) },
    { name: 'Low', value: low, percent: ((low / total) * 100).toFixed(2) },
  ];
};

function App() {
  const [folder, setFolder] = useState(null);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [dataClassResults, setDataClassResults] = useState([]);
  const [parallelResults, setParallelResults] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false); // State for modal visibility
  const [isModalOpen2, setIsModalOpen2] = useState(false);
  const [modalContent, setModalContent] = useState(null);
  const [modalContent2, setModalContent2] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleFolderChange = (event) => {
    const file = event.target.files[0];

    // Reset hasil dan error setiap kali file diubah
    setResults([]);
    setError(null);
    setDataClassResults([]);
    setParallelResults([]);

    if (file) {
      const fileExtension = file.name.split('.').pop().toLowerCase();

      // Cek apakah ekstensi file adalah zip
      if (fileExtension !== 'zip') {
        setError('Only ZIP files are allowed');
      } else {
        setFolder(file); // Set file jika file valid
      }
    }
  };

  const handleAnalyze = async () => {
    if (!folder) {
      setError('Please upload a folder (zipped) containing PHP files before analyzing.');
      return;
    }

    const formData = new FormData();
    formData.append('folder', folder);

    setIsLoading(true);
    try {
      const response = await axios.post(`${config.BASE_URL}/api/maintainability/analyze`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const dataClassResponse = await axios.post(`${config.BASE_URL}/api/maintainability/dataclass`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const parallelResponse = await axios.post(`${config.BASE_URL}/api/maintainability/parallel`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      console.log('DataClass Smell:', dataClassResponse.data.data);
      setDataClassResults(dataClassResponse.data.data);
      setParallelResults(parallelResponse.data.data);

      console.log(response.data.data1);
      setResults(response.data.data1);
    } catch (err) {
      console.error(err);
      setError('An error occurred while analyzing the folder. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleModalOpen = (content) => {
    setModalContent(content); // Set the modal content
    setIsModalOpen(true); // Open the modal
  };

  const handleModalClose = () => {
    setIsModalOpen(false); // Close the modal
  };
  const handleModalOpen2 = (content) => {
    setModalContent2(content); // Set the modal content
    setIsModalOpen2(true); // Open the modal
  };

  const handleModalClose2 = () => {
    setIsModalOpen2(false); // Close the modal
  };

  const scrollToSection = (id) => {
    const section = document.getElementById(id);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const getMaintainabilityClass = (index) => {
    if (index > 85) return 'maintainability-high'; // Nilai tinggi
    if (index > 65 && index <= 85) return 'maintainability-medium'; // Nilai sedang
    return 'maintainability-low'; // Nilai rendah
  };

  const handleDownloadCSV = async () => {
    if (!results.length) {
      setError('No results available to export.');
      return;
    }

    setIsDownloading(true);
    try {
      const response = await axios.post(`${config.BASE_URL}/api/maintainability/export-csv`, { analysisResults: results, dataClassResults, parallelResults }, { responseType: 'blob' });

      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);

      // Buat link untuk mendownload file
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'analysis_results.csv');
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      console.error(err);
      setError('An error occurred while exporting CSV. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Code Maintainability Analyzer and Code Smell Identification</h1>

        <input type="file" accept=".zip" onChange={handleFolderChange} />
        <button onClick={handleAnalyze}> {isLoading ? 'Analyzing...' : 'Analyze'}</button>
        <button onClick={handleDownloadCSV}> {isDownloading ? 'Downloading...' : 'Download CSV'}</button>
        <button onClick={() => handleModalOpen2()}>Guide</button>
        <button onClick={() => handleModalOpen()}>About</button>

        {error && <p className="error">{error}</p>}
        {isLoading && <p>Loading, please wait...</p>}

        {results.length > 0 ? (
          <div className="results">
            {results.length > 0 && (
              <>
                <div className="chart-container">
                  <h2 id="maintainability-title" onClick={() => scrollToSection('maintainability-table')} style={{ cursor: 'pointer' }}>
                    Maintainability Index Distribution
                  </h2>
                  <PieChart width={700} height={400}>
                    <Pie
                      data={calculatePieChartData(results)}
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, value, percent }) => {
                        // Hitung persentase secara manual
                        const totalValue = calculatePieChartData(results).reduce((sum, item) => sum + item.value, 0);
                        const percentage = ((value / totalValue) * 100).toFixed(1);
                        return `${name}: ${value} (${percentage}%)`; // Menambahkan value dan persentase
                      }}
                    >
                      {calculatePieChartData(results).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => `${value} files (${name})`} />
                    <Legend />
                  </PieChart>
                </div>
              </>
            )}
            {dataClassResults.length > 0 && (
              <div className="chart-container">
                <h2 id="dataclass-title" onClick={() => scrollToSection('dataclass-table')} style={{ cursor: 'pointer' }}>
                  Data Class Smell
                </h2>
                <PieChart width={700} height={400}>
                  <Pie
                    data={[
                      { name: 'Detected', value: dataClassResults.filter((item) => item.isDataClassSmell).length },
                      { name: 'Not Detected', value: dataClassResults.filter((item) => !item.isDataClassSmell).length },
                    ]}
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(2)}%)`}
                  >
                    <Cell key="detected" fill="#FF0000" />
                    <Cell key="not-detected" fill="#008000" />
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </div>
            )}

            {parallelResults.length > 0 && (
              <div className="chart-container">
                <h2 id="parallel-title" onClick={() => scrollToSection('parallel-table')} style={{ cursor: 'pointer' }}>
                  Parallel Inheritance Hierarchies Smell
                </h2>
                <PieChart width={700} height={400}>
                  <Pie
                    data={[
                      { name: 'Detected', value: parallelResults.filter((item) => item.isParallelInheritanceSmell).length },
                      { name: 'Not Detected', value: parallelResults.filter((item) => !item.isParallelInheritanceSmell).length },
                    ]}
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(2)}%)`}
                  >
                    <Cell key="detected" fill="#FF0000" />
                    <Cell key="not-detected" fill="#008000" />
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </div>
            )}
          </div>
        ) : (
          ''
        )}

        {results.length > 0 ? (
          <div className="results" id="maintainability-table">
            <h2>Analyze Results Maintainability Index</h2>
            <table>
              <thead>
                <tr>
                  <th>File Number</th>
                  <th>File Name</th>
                  <th>Maintainability Index</th>
                  <th>Explanation</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td>{result.fileName}</td>
                    <td className={getMaintainabilityClass(result.maintainability.maintainabilityIndex)}>{result.maintainability.maintainabilityIndex}</td>
                    <td>{result.maintainability.explanation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          ''
        )}

        {dataClassResults.length > 0 && (
          <div className="results" id="dataclass-table">
            <h2>Data Class Smell Detection</h2>
            <div className="chart-container"></div>

            <table>
              <thead>
                <tr>
                  <th>No</th>
                  <th>File Name</th>
                  <th>Class Name</th>
                  <th>WMC</th>
                  <th>LCOM</th>
                  <th>Data Class Smell</th>
                </tr>
              </thead>
              <tbody>
                {dataClassResults.map((item, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td>{item.fileName}</td>
                    <td>{item.className}</td>
                    <td>{item.WMC !== null ? item.WMC : '-'}</td>
                    <td>{item.LCOM !== null ? item.LCOM : '-'}</td>
                    <td style={{ color: item.isDataClassSmell ? 'red' : 'green' }}>{item.isDataClassSmell ? 'Detected' : 'Not Detected'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {parallelResults.length > 0 && (
          <div className="results" id="parallel-table">
            <h2>Parallel Inheritance Hierarchies Smell Detection</h2>
            <table>
              <thead>
                <tr>
                  <th>No</th>
                  <th>File Name</th>
                  <th>Class Name</th>
                  <th>DIT</th>
                  <th>NOC</th>
                  <th>Parallel Inheritance Hierarchies Smell</th>
                </tr>
              </thead>
              <tbody>
                {parallelResults.map((item, index) => {
                  // Cari fileName yang sesuai dari dataClassResults berdasarkan className
                  const dataClassItem = dataClassResults.find((dataItem) => dataItem.className === item.className);
                  const fileName = dataClassItem ? dataClassItem.fileName : item.fileName; // Jika ditemukan, ganti fileName, jika tidak gunakan fileName dari parallelResults

                  return (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      <td>{fileName}</td> {/* Menggunakan fileName yang sudah disesuaikan */}
                      <td>{item.className}</td>
                      <td>{item.DIT !== null ? item.DIT : '-'}</td>
                      <td>{item.NOC !== null ? item.NOC : '-'}</td>
                      <td style={{ color: item.isParallelInheritanceSmell ? 'red' : 'green' }}>{item.isParallelInheritanceSmell ? 'Detected' : 'Not Detected'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </header>

      {/* Modal for Maintainability Index and Code Smell */}
      {isModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <button className="close-btn" onClick={handleModalClose}>
              X
            </button>

            <h1>Maintainability Index</h1>
            <p>The Maintainability Index is a metric used to measure how easy or difficult it is to maintain or modify code in the future. It is calculated based on three key factors:</p>
            <ul>
              <li>
                <strong>Lines of Code (LOC)</strong>
              </li>
              <li>
                <strong>Cyclomatic Complexity (CC)</strong>
              </li>
              <li>
                <strong>Halstead Volume (HV)</strong>
              </li>
            </ul>

            <h3>Formula:</h3>
            <p>
              <code>MI = 171 − 5.2 × ln(HV) − 0.23 × CC − 16.2 × ln(LOC)</code>
            </p>

            <h3>Classification:</h3>
            <ul>
              <li>
                <strong>MI &gt; 85</strong>: Very Easy to Maintain
              </li>
              <li>
                <strong>65 &lt; MI ≤ 85</strong>: Fairly Easy to Maintain
              </li>
              <li>
                <strong>MI ≤ 65</strong>: Difficult to Maintain
              </li>
            </ul>

            <h1>Code Smell</h1>
            <p>A code smell is an indication that something in the code may not be optimal. While it may not directly cause bugs, it can affect software quality and maintainability in the long term.</p>

            <p>Common metrics used:</p>
            <ul>
              <li>
                <strong>WMC</strong> (Weighted Methods per Class)
              </li>
              <li>
                <strong>LCOM</strong> (Lack of Cohesion of Methods)
              </li>
              <li>
                <strong>DIT</strong> (Depth of Inheritance Tree)
              </li>
              <li>
                <strong>NOC</strong> (Number of Children)
              </li>
            </ul>

            <h2>Detected Code Smell Types</h2>

            <h3>1. Data Class</h3>
            <p>A class that mainly contains data (attributes and simple getters/setters) with little or no meaningful behavior. It doesn't perform any logic but just holds data for other classes to use.</p>
            <p>
              <strong>Threshold:</strong> WMC &gt; 50 or LCOM &gt; 0.8
            </p>

            <h3>2. Parallel Inheritance Hierarchies</h3>
            <p>Happens when two inheritance hierarchies evolve in parallel. Every time you create a subclass in one hierarchy, you also need to create a corresponding subclass in the other.</p>
            <p>
              <strong>Threshold:</strong> DIT &gt; 3 or NOC &gt; 4
            </p>
          </div>
        </div>
      )}

      {isModalOpen2 && (
        <div className="modal">
          <div className="modal-content">
            <button className="close-btn" onClick={handleModalClose2}>
              X
            </button>

            <h1>User Guide</h1>
            <h2>Code Maintainability Analyzer & Code Smell Detection</h2>

            <p>
              This application allows you to analyze the <strong>maintainability</strong> of your PHP code and detect code smells such as <strong>Data Class</strong> and <strong>Parallel Inheritance Hierarchies</strong>. Results are
              visualized through interactive charts and detailed tables.
            </p>

            <h4>1. Upload Your PHP Code</h4>
            <ul>
              <li>
                Click the <strong>"Choose File"</strong> button.
              </li>
              <li>
                Choose a <code>.zip</code> file containing your PHP source code.
              </li>
              <li>Ensure the file is in the correct format.</li>
            </ul>
            <p>
              <strong>Note:</strong>
            </p>
            <ul>
              <li>
                Only <code>.zip</code> files are accepted.
              </li>
              <li>
                The ZIP file must contain <code>.php</code> files only.
              </li>
            </ul>

            <h4>2. Run the Analysis</h4>
            <ul>
              <li>
                After uploading, click the <strong>"Analyze"</strong> button.
              </li>
              <li>The system will analyze your PHP code for:</li>
              <ul>
                <li>
                  <strong>Maintainability Index</strong>
                </li>
                <li>
                  <strong>Code Smells:</strong> Data Class & Parallel Inheritance Hierarchies
                </li>
              </ul>
            </ul>
            <p>
              <strong>Important:</strong>
            </p>
            <ul>
              <li>
                Code smell detection only applies to PHP files that contain <strong>classes</strong>.
              </li>
              <li>
                Each file should contain only <strong>one class</strong> for accurate results.
              </li>
            </ul>

            <h4>3. View the Results</h4>
            <p>Once analysis is complete, results will be displayed as:</p>
            <ul>
              <li>
                <strong>Charts:</strong>
                <ul>
                  <li>Maintainability Index distribution</li>
                  <li>Frequency of Data Class smells</li>
                  <li>Frequency of Parallel Inheritance smells</li>
                </ul>
              </li>
              <li>
                <strong>Tables:</strong>
                <ul>
                  <li>Maintainability scores per file</li>
                  <li>Detected code smells with file names and class name</li>
                </ul>
              </li>
            </ul>

            <h4>4. (Optional) Download the Report</h4>
            <p>
              Click the <strong>"Download CSV"</strong> button to download a comprehensive report of the analysis.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
