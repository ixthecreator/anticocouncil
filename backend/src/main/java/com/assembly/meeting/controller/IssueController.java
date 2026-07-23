package com.assembly.meeting.controller;

import com.assembly.meeting.model.Issue;
import com.assembly.meeting.repository.IssueRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/issues")
@CrossOrigin(origins = "*")
public class IssueController {

    private final IssueRepository issueRepository;

    @Autowired
    public IssueController(IssueRepository issueRepository) {
        this.issueRepository = issueRepository;
    }

    @GetMapping
    public List<Issue> getAllIssues(@RequestParam(required = false) String meetingId) {
        if (meetingId != null && !meetingId.trim().isEmpty()) {
            return issueRepository.findByMeetingId(meetingId);
        }
        return issueRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Issue> getIssueById(@PathVariable String id) {
        Optional<Issue> issue = issueRepository.findById(id);
        return issue.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Issue> createOrUpdateIssue(@RequestBody Issue issue) {
        if (issue.getId() == null || issue.getId().trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        Issue saved = issueRepository.save(issue);
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Issue> updateIssue(@PathVariable String id, @RequestBody Issue issueDetails) {
        return issueRepository.findById(id)
                .map(existingIssue -> {
                    existingIssue.setTitle(issueDetails.getTitle());
                    existingIssue.setCategory(issueDetails.getCategory());
                    existingIssue.setPriority(issueDetails.getPriority());
                    existingIssue.setStatus(issueDetails.getStatus());
                    existingIssue.setDescription(issueDetails.getDescription());
                    existingIssue.setDiscussion(issueDetails.getDiscussion());
                    existingIssue.setSignature(issueDetails.getSignature());
                    existingIssue.setUpdatedAt(issueDetails.getUpdatedAt());
                    existingIssue.setArchived(issueDetails.isArchived());
                    existingIssue.setArchivedAt(issueDetails.getArchivedAt());
                    existingIssue.setMeetingId(issueDetails.getMeetingId());
                    Issue updated = issueRepository.save(existingIssue);
                    return ResponseEntity.ok(updated);
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteIssue(@PathVariable String id) {
        if (!issueRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        issueRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
