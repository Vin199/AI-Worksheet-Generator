import * as XLSX from 'xlsx';

/**
 * Exports worksheet data to a formatted Excel file with multiple sheets
 * Each question type gets its own sheet with appropriate columns
 * @param {Object} worksheetData - The worksheet data from API
 */
export function exportWorksheetToExcel(worksheetData) {
  const data = worksheetData.data;
  const workbook = XLSX.utils.book_new();

  // Question type configurations - defines columns for each type
  const questionTypeConfig = {
    mcq_single_answer: {
      sheetName: 'MCQ Single Answer',
      columns: ['Question No.', 'Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Answer', 'Learning Objectives', 'Bloom Taxonomy', 'Difficulty', 'Learning Objective Explanation', 'Explanation', 'Key Concepts', 'Common Mistakes', 'Real World Application']
    },
    mcq_multiple_answer: {
      sheetName: 'MCQ Multiple Answer',
      columns: ['Question No.', 'Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Option E', 'Option F', 'Answer', 'Learning Objectives', 'Bloom Taxonomy', 'Difficulty']
    },
    true_false: {
      sheetName: 'True False',
      columns: ['Question No.', 'Question', 'Answer', 'Learning Objectives', 'Bloom Taxonomy', 'Difficulty']
    },
    fill_in_the_blanks: {
      sheetName: 'Fill in the Blanks',
      columns: ['Question No.', 'Question', 'Answer', 'Learning Objectives', 'Bloom Taxonomy', 'Difficulty']
    },
    very_short_answer: {
      sheetName: 'Very Short Answer',
      columns: ['Question No.', 'Question', 'Answer', 'Learning Objectives', 'Bloom Taxonomy', 'Difficulty']
    },
    short_answer: {
      sheetName: 'Short Answer',
      columns: ['Question No.', 'Question', 'Answer', 'Learning Objectives', 'Bloom Taxonomy', 'Difficulty']
    },
    long_answer: {
      sheetName: 'Long Answer',
      columns: ['Question No.', 'Question', 'Answer', 'Learning Objectives', 'Bloom Taxonomy', 'Difficulty']
    },
    match_the_column: {
      sheetName: 'Match the Column',
      columns: ['Question No.', 'Question', 'Column A', 'Column B', 'Answer', 'Learning Objectives', 'Bloom Taxonomy', 'Difficulty']
    }
  };

  // Create Summary Sheet
  const summaryData = [
    ['Worksheet Information'],
    [''],
    ['Board', data.board?.name || 'N/A'],
    ['Grade', data.grade?.name || 'N/A'],
    ['Subject', data.subject?.name || 'N/A'],
    ['Topic', data.topic || 'N/A'],
    ['Section', data.section || 'N/A'],
    ['Total Questions', data.number_of_questions || 0],
    ['Status', data.status || 'N/A'],
    ['Worksheet ID', data.id || 'N/A'],
    [''],
    ['Question Distribution by Type'],
    ['Question Type', 'Count']
  ];

  // Add question type counts to summary
  Object.entries(data.questions).forEach(([type, questions]) => {
    if (questions && questions.length > 0) {
      const typeName = type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      summaryData.push([typeName, questions.length]);
    }
  });

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);

  // Set column widths for summary sheet
  summarySheet['!cols'] = [
    { wch: 25 },
    { wch: 30 }
  ];

  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Process each question type
  let globalQuestionNumber = 1;

  Object.entries(data.questions).forEach(([questionType, questionList]) => {
    if (!questionList || questionList.length === 0) return;

    const config = questionTypeConfig[questionType];
    if (!config) return; // Skip if no config found

    const sheetData = [];

    // Add headers
    sheetData.push(config.columns);

    // Process each question
    questionList.forEach((question) => {
      const row = [];

      // Question Number
      row.push(globalQuestionNumber);
      globalQuestionNumber++;

      // Question Text
      row.push(question.question || '');

      // Handle different question types
      if (questionType === 'mcq_single_answer' || questionType === 'mcq_multiple_answer') {
        // Add options
        const options = question.options || [];
        const maxOptions = questionType === 'mcq_multiple_answer' ? 6 : 4;

        for (let i = 0; i < maxOptions; i++) {
          if (options[i]) {
            // Remove the letter prefix (A., B., etc.) if present
            const optionText = options[i].replace(/^[A-F]\.\s*/, '');
            row.push(optionText);
          } else {
            row.push('');
          }
        }
      } else if (questionType === 'match_the_column') {
        // Handle match the column (if structure is known)
        // Assuming question might have columnA and columnB arrays
        const columnA = question.columnA ? JSON.stringify(question.columnA) : '';
        const columnB = question.columnB ? JSON.stringify(question.columnB) : '';
        row.push(columnA);
        row.push(columnB);
      }

      // Answer
      row.push(question.answer || '');

      // Tags
      if (question.tags) {
        row.push(question.tags.learning_objectives || '');
        row.push(question.tags.bloom || '');
        row.push(question.tags.difficulty || '');
      } else {
        row.push('', '', '');
      }

      //Explanations
      if(question?.explanations && Array.isArray(question?.explanations) && question?.explanations.length > 0){
        row.push(question?.explanations[0]?.learning_objective || '');
        row.push(question?.explanations[0]?.explanation || '');
        let keyConcepts = '';
        question?.explanations[0]?.key_concepts.forEach((str) => {
          keyConcepts += str + "," + "\n";
        })
        row.push(keyConcepts || '');
        row.push(question?.explanations[0]?.common_mistakes || '');
        row.push(question?.explanations[0]?.real_world_application || '');
      }

      sheetData.push(row);
    });

    // Create worksheet from data
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

    // Set column widths based on question type
    const colWidths = [
      { wch: 12 }, // Question No.
      { wch: 60 }, // Question
    ];

    // Add widths for options or other fields
    if (questionType === 'mcq_single_answer') {
      colWidths.push({ wch: 40 }, { wch: 40 }, { wch: 40 }, { wch: 40 }); // Options A-D
      colWidths.push({ wch: 10 }); // Answer
    } else if (questionType === 'mcq_multiple_answer') {
      colWidths.push({ wch: 35 }, { wch: 35 }, { wch: 35 }, { wch: 35 }, { wch: 35 }, { wch: 35 }); // Options A-F
      colWidths.push({ wch: 15 }); // Answer
    } else if (questionType === 'match_the_column') {
      colWidths.push({ wch: 30 }, { wch: 30 }); // Column A & B
      colWidths.push({ wch: 20 }); // Answer
    } else {
      colWidths.push({ wch: 50 }); // Answer
    }

    // Tags columns
    colWidths.push({ wch: 40 }, { wch: 15 }, { wch: 12 });

    //Explanation columns
    colWidths.push({ wch: 80 }, { wch: 80 }, { wch: 20 }, { wch: 80 }, { wch: 80 });

    worksheet['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, config.sheetName);
  });

  // Generate filename
  const fileName = `Worksheet_${data.subject?.name || 'Unknown'}_${data.topic || 'General'}_${new Date().getTime()}.xlsx`;

  // Write the file
  XLSX.writeFile(workbook, fileName);
}
